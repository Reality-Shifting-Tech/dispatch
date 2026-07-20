import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./client.js";
import {
  addSuppression,
  appendOutbox,
  casCampaignStatus,
  claimMessage,
  consumeSendConfirmation,
  fetchDueOutbox,
  insertEventDedup,
  insertInboundWebhookDedup,
  insertMessagesBatch,
  isSuppressed,
  markOutboxAttemptFailed,
  markOutboxDispatched,
  replayInboundWebhook,
  settleInboundWebhook,
} from "./repositories.js";
import {
  campaignRecipients,
  campaignVersions,
  campaigns,
  contacts,
  lists,
  relays,
  sendConfirmations,
  suppressions,
  workspaces,
} from "./schema.js";
import { createTestDb } from "./testing.js";
import { uuidv7 } from "./uuidv7.js";

let db: Database;
let close: () => Promise<void>;
let workspaceId: string;
let relayId: string;
let campaignId: string;
let campaignVersionId: string;
let contactId: string;
let recipientId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  workspaceId = uuidv7();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: "Test",
    slug: "test",
    organizationName: "Test Inc",
    postalAddress: "1 Main St",
  });
  relayId = uuidv7();
  await db.insert(relays).values({
    id: relayId,
    workspaceId,
    type: "ses",
    name: "SES",
    credentialsEncrypted: "v1.x.y.z",
    capabilities: {
      providerIdempotency: true,
      deliveryEvents: true,
      bounceEvents: true,
      complaintEvents: true,
      scheduling: false,
    },
  });
  campaignId = uuidv7();
  await db.insert(campaigns).values({ id: campaignId, workspaceId, name: "June" });
  campaignVersionId = uuidv7();
  const listId = uuidv7();
  await db.insert(lists).values({ id: listId, workspaceId, name: "news" });
  await db.insert(campaignVersions).values({
    id: campaignVersionId,
    campaignId,
    version: 1,
    subject: "Hi",
    fromName: "News",
    fromEmail: "news@example.com",
    bodyHtml: "<p>hi</p>",
    bodyText: "hi",
    audienceRef: listId,
  });
  contactId = uuidv7();
  await db.insert(contacts).values({
    id: contactId,
    workspaceId,
    emailNormalized: "a@example.com",
    emailOriginal: "a@example.com",
  });
  recipientId = uuidv7();
  await db.insert(campaignRecipients).values({
    id: recipientId,
    campaignId,
    campaignVersionId,
    contactId,
    email: "a@example.com",
  });
});

afterAll(async () => {
  await close();
});

describe("casCampaignStatus", () => {
  it("moves only when the current status matches", async () => {
    const moved = await casCampaignStatus(db, campaignId, ["draft"], "ready");
    expect(moved?.status).toBe("ready");
    const again = await casCampaignStatus(db, campaignId, ["draft"], "ready");
    expect(again).toBeNull();
  });
});

describe("messages", () => {
  it("deduplicates by id on batch insert", async () => {
    const row = {
      id: uuidv7(),
      workspaceId,
      campaignId,
      campaignRecipientId: recipientId,
      contactId,
      relayId,
    };
    expect(await insertMessagesBatch(db, [row])).toBe(1);
    expect(await insertMessagesBatch(db, [row])).toBe(0);
  });

  it("claims a queued message exactly once", async () => {
    const id = uuidv7();
    await insertMessagesBatch(db, [
      { id, workspaceId, campaignId, campaignRecipientId: recipientId, contactId, relayId },
    ]);
    const first = await claimMessage(db, id);
    expect(first?.status).toBe("sending");
    expect(first?.attempts).toBe(1);
    const second = await claimMessage(db, id);
    expect(second).toBeNull();
  });
});

describe("events dedup", () => {
  it("stores the first event and drops replays", async () => {
    const base = {
      workspaceId,
      relayId,
      providerEventId: "evt-1",
      payloadHash: "hash-1",
      type: "delivered" as const,
      occurredAt: new Date(),
    };
    expect(await insertEventDedup(db, base)).not.toBeNull();
    expect(await insertEventDedup(db, { ...base, payloadHash: "hash-2" })).toBeNull();
    expect(await insertEventDedup(db, { ...base, providerEventId: "evt-2" })).toBeNull();
  });
});

describe("inbound webhook inbox", () => {
  it("stores raw payloads idempotently", async () => {
    const row = {
      workspaceId,
      relayId,
      headers: { "x-test": "1" },
      payload: "{}",
      payloadHash: "wh-1",
    };
    const first = await insertInboundWebhookDedup(db, row);
    expect(first.outcome).toBe("inserted");
    const second = await insertInboundWebhookDedup(db, row);
    expect(second.outcome).toBe("duplicate");
  });

  it("supports admin replay as a fresh row linked to the original", async () => {
    const inserted = await insertInboundWebhookDedup(db, {
      workspaceId,
      relayId,
      headers: {},
      payload: '{"a":1}',
      payloadHash: "wh-replay",
    });
    await settleInboundWebhook(db, inserted.id as string, "failed", "boom");
    const replay = await replayInboundWebhook(db, inserted.id as string);
    expect(replay).not.toBeNull();
    expect(replay?.replayOf).toBe(inserted.id);
    expect(replay?.status).toBe("received");
  });
});

describe("outbox", () => {
  it("dispatches due rows and backs off failures", async () => {
    const row = await appendOutbox(db, {
      workspaceId,
      topic: "campaign.send",
      payload: { campaignId },
    });
    const due = await fetchDueOutbox(db, 10);
    expect(due.map((r) => r.id)).toContain(row.id);
    await markOutboxAttemptFailed(db, row, "redis down");
    const notYetDue = await fetchDueOutbox(db, 10);
    expect(notYetDue.map((r) => r.id)).not.toContain(row.id);
    const fresh = await appendOutbox(db, {
      workspaceId,
      topic: "campaign.send",
      payload: { campaignId },
    });
    await markOutboxDispatched(db, fresh.id);
    const remaining = await fetchDueOutbox(db, 10);
    expect(remaining.map((r) => r.id)).not.toContain(fresh.id);
  });
});

describe("send confirmations", () => {
  it("consumes a token exactly once and rejects expiry", async () => {
    const hash = "confirm-hash-1";
    await db.insert(sendConfirmations).values({
      workspaceId,
      campaignId,
      campaignVersionId,
      tokenHash: hash,
      actorType: "api_key",
      actorId: "key-1",
      audienceHash: "aud",
      recipientCount: 3,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const first = await consumeSendConfirmation(db, hash);
    expect(first?.recipientCount).toBe(3);
    expect(await consumeSendConfirmation(db, hash)).toBeNull();

    const expiredHash = "confirm-hash-expired";
    await db.insert(sendConfirmations).values({
      workspaceId,
      campaignId,
      campaignVersionId,
      tokenHash: expiredHash,
      actorType: "api_key",
      actorId: "key-1",
      audienceHash: "aud",
      recipientCount: 3,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await consumeSendConfirmation(db, expiredHash)).toBeNull();
  });
});

describe("suppressions", () => {
  it("adds and detects suppressions", async () => {
    expect(await isSuppressed(db, workspaceId, "b@example.com")).toBe(false);
    await addSuppression(db, {
      workspaceId,
      emailNormalized: "b@example.com",
      reason: "hard_bounce",
      source: "webhook",
    });
    expect(await isSuppressed(db, workspaceId, "b@example.com")).toBe(true);
  });

  it("re-activates a lifted suppression with the new reason", async () => {
    const first = await addSuppression(db, {
      workspaceId,
      emailNormalized: "c@example.com",
      reason: "manual",
      source: "admin",
    });
    await db
      .update(suppressions)
      .set({ liftedAt: new Date() })
      .where(eq(suppressions.id, first?.id ?? ""));
    expect(await isSuppressed(db, workspaceId, "c@example.com")).toBe(false);
    const readded = await addSuppression(db, {
      workspaceId,
      emailNormalized: "c@example.com",
      reason: "complaint",
      source: "webhook",
    });
    expect(readded?.reason).toBe("complaint");
    expect(readded?.liftedAt).toBeNull();
    expect(await isSuppressed(db, workspaceId, "c@example.com")).toBe(true);
  });
});
