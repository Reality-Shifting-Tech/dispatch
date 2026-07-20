import {
  campaigns,
  campaignRecipients,
  campaignVersions,
  contacts,
  listMemberships,
  lists,
  messages as messagesTable,
  relays,
  senderIdentities,
  uuidv7,
  workspaces,
} from "@mailpelican/db";
import { createTestDb } from "@mailpelican/db/testing";
import type { Database } from "@mailpelican/db";
import { WARMUP_START_CAP } from "@mailpelican/domain";
import { createMemoryRateLimiter } from "@mailpelican/queue";
import { FakeRelay } from "@mailpelican/testkit";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dispatchMessage, RateLimitedError, type PipelineDeps } from "./pipeline.js";

const env = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  PUBLIC_URL: "https://mail.example.com",
  TRACKING_URL: "https://track.example.com",
  DATABASE_URL: "postgres://localhost/dispatch",
  REDIS_URL: "redis://localhost:6379",
  CREDENTIAL_ENCRYPTION_KEY: "a".repeat(32),
  SESSION_SECRET: "b".repeat(32),
  PORT: 3000,
} as const;

let db: Database;
let close: () => Promise<void>;
let fakeRelay: FakeRelay;
let deps: PipelineDeps;
let workspaceId: string;
let relayId: string;
let listId: string;
let messageId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  fakeRelay = new FakeRelay({ providerIdempotency: true });
  const limiter = createMemoryRateLimiter();
  deps = { db, env, limiter, createProvider: async () => fakeRelay };

  workspaceId = uuidv7();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: "W",
    slug: `w-${workspaceId.slice(0, 8)}`,
    organizationName: "Widget Inc",
    postalAddress: "1 Main St",
  });
  relayId = uuidv7();
  await db.insert(relays).values({
    id: relayId,
    workspaceId,
    type: "ses",
    name: "warming",
    credentialsEncrypted: "v1.x.y.z",
    capabilities: {
      providerIdempotency: true,
      deliveryEvents: true,
      bounceEvents: true,
      complaintEvents: true,
      scheduling: false,
    },
    status: "ready",
    warmupStartedAt: new Date(),
    warmupDays: 14,
  });
  const identityId = uuidv7();
  await db.insert(senderIdentities).values({
    id: identityId,
    workspaceId,
    relayId,
    domain: "example.com",
    fromEmail: "news@example.com",
    fromName: "News",
    verificationStatus: "verified",
  });
  listId = uuidv7();
  await db.insert(lists).values({ id: listId, workspaceId, name: "news" });
  const contactId = uuidv7();
  await db.insert(contacts).values({
    id: contactId,
    workspaceId,
    emailNormalized: "ada@example.com",
    emailOriginal: "ada@example.com",
  });
  await db.insert(listMemberships).values({ workspaceId, contactId, listId, state: "subscribed" });

  const campaignId = uuidv7();
  await db.insert(campaigns).values({
    id: campaignId,
    workspaceId,
    name: "C",
    status: "sending",
    relayId,
    senderIdentityId: identityId,
  });
  const versionId = uuidv7();
  await db.insert(campaignVersions).values({
    id: versionId,
    campaignId,
    version: 1,
    subject: "s",
    fromName: "N",
    fromEmail: "news@example.com",
    bodyHtml: "<p>Hi</p>",
    bodyText: "Hi",
    audienceRef: listId,
  });
  await db
    .update(campaigns)
    .set({ currentVersionId: versionId })
    .where(eq(campaigns.id, campaignId));
  messageId = uuidv7();
  await db.insert(campaignRecipients).values({
    id: messageId,
    campaignId,
    campaignVersionId: versionId,
    contactId,
    email: "ada@example.com",
    status: "included",
  });
  await db.insert(messagesTable).values({
    id: messageId,
    workspaceId,
    campaignId,
    campaignRecipientId: messageId,
    contactId,
    relayId,
    status: "queued",
  });

  // Exhaust today's warmup budget (50/day on day 0).
  const dayKey = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < WARMUP_START_CAP; i += 1) {
    await limiter.take(`relay-warmup:${relayId}:${dayKey}`, {
      ratePerSecond: WARMUP_START_CAP / 86_400,
      burst: WARMUP_START_CAP,
    });
  }
});

afterAll(async () => {
  await close();
});

describe("IP warmup gate", () => {
  it("defers messages once the daily warmup budget is spent", async () => {
    await expect(dispatchMessage(deps, messageId)).rejects.toBeInstanceOf(RateLimitedError);
    expect(fakeRelay.sent).toHaveLength(0);
    const row = await db.query.messages.findFirst({
      where: (t, { eq: e }) => e(t.id, messageId),
    });
    expect(row?.status).toBe("queued");
  });
});
