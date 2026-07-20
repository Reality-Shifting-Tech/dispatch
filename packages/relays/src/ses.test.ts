import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildRawMime, isAllowedSnsCertUrl, SesRelay, snsSigningString } from "./ses.js";
import type { PreparedMessage } from "./types.js";

const message: PreparedMessage = {
  messageId: "018e0f5e-0000-7000-8000-000000000001",
  fromEmail: "news@example.com",
  fromName: "News",
  replyTo: null,
  toEmail: "user@example.org",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  headers: {
    "List-Unsubscribe": "<https://example.com/unsub/abc>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
};

const context = { workspaceId: "w", relayId: "r", campaignId: "c" };

function makeSnsBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    Type: "Notification",
    MessageId: "sns-msg-1",
    TopicArn: "arn:aws:sns:us-east-1:123:ses",
    Message: JSON.stringify({
      eventType: "Delivery",
      mail: { messageId: "ses-provider-1" },
      delivery: { timestamp: "2025-06-01T00:00:00.000Z" },
    }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1",
    Signature: "",
    SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
    ...overrides,
  });
}

describe("buildRawMime", () => {
  it("includes compliance headers and both bodies", () => {
    const raw = buildRawMime(message);
    expect(raw).toContain("List-Unsubscribe: <https://example.com/unsub/abc>");
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(raw).toContain(Buffer.from("<p>Hi</p>", "utf8").toString("base64"));
    expect(raw).toContain("multipart/alternative");
  });

  it("strips CRLF from header values to prevent injection", () => {
    const raw = buildRawMime({ ...message, subject: "Hi\r\nBCC: evil@example.com" });
    expect(raw).not.toMatch(/\r\nBCC:/i);
    expect(raw).toContain("Subject: Hi BCC: evil@example.com");
  });
});

describe("SesRelay.send", () => {
  it("sends raw email and returns the provider message id", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "ses-provider-1" });
    const relay = new SesRelay({ send }, undefined, async () => "");
    const result = await relay.send(message, context);
    expect(result.providerMessageId).toBe("ses-provider-1");
    const command = send.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    const content = command.input.Content as { Raw: { Data: Buffer } };
    expect(content.Raw.Data.toString("utf8")).toContain("List-Unsubscribe:");
    const tags = command.input.EmailTags as { Name: string; Value: string }[];
    expect(tags).toContainEqual({ Name: "dispatch_message_id", Value: message.messageId });
  });

  it("declares full feedback capabilities", () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, async () => "");
    expect(relay.capabilities).toEqual({
      providerIdempotency: true,
      deliveryEvents: true,
      bounceEvents: true,
      complaintEvents: true,
      scheduling: false,
    });
  });
});

describe("SesRelay.testConnection", () => {
  it("reports ok when the account is reachable", async () => {
    const relay = new SesRelay({ send: vi.fn().mockResolvedValue({}) }, undefined, async () => "");
    expect((await relay.testConnection()).ok).toBe(true);
  });

  it("reports failure with detail", async () => {
    const relay = new SesRelay(
      { send: vi.fn().mockRejectedValue(new Error("invalid token")) },
      undefined,
      async () => "",
    );
    const health = await relay.testConnection();
    expect(health).toEqual({ ok: false, detail: "invalid token" });
  });
});

describe("SesRelay webhooks", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  function signedBody(overrides: Record<string, unknown> = {}) {
    const unsigned = JSON.parse(makeSnsBody(overrides)) as Parameters<typeof snsSigningString>[0];
    const signer = createSign("RSA-SHA1");
    signer.update(snsSigningString(unsigned), "utf8");
    unsigned.Signature = signer.sign(privateKey, "base64");
    return JSON.stringify(unsigned);
  }

  const fetchCertificate = async () => publicKey.export({ type: "spki", format: "pem" }).toString();

  it("verifies a properly signed SNS notification", async () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, fetchCertificate);
    const result = await relay.verifyWebhook({ headers: {}, body: signedBody() });
    expect(result.valid).toBe(true);
  });

  it("rejects a forged signature", async () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, fetchCertificate);
    const body = JSON.parse(signedBody()) as Record<string, unknown>;
    body.Message = JSON.stringify({ eventType: "Bounce", mail: {} });
    const result = await relay.verifyWebhook({ headers: {}, body: JSON.stringify(body) });
    expect(result).toEqual({ valid: false, reason: "sns signature mismatch" });
  });

  it("rejects stale timestamps", async () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, fetchCertificate);
    const body = signedBody({ Timestamp: "2020-01-01T00:00:00.000Z" });
    const result = await relay.verifyWebhook({ headers: {}, body });
    expect(result).toEqual({ valid: false, reason: "sns timestamp outside tolerance" });
  });

  it("normalizes SES events to internal types", async () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, fetchCertificate);
    const verified = await relay.verifyWebhook({ headers: {}, body: signedBody() });
    const events = await relay.normalizeWebhook(verified);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerEventId: "sns-msg-1",
      type: "delivered",
      providerMessageId: "ses-provider-1",
    });
  });

  it("maps bounce and complaint events", async () => {
    const relay = new SesRelay({ send: vi.fn() }, undefined, fetchCertificate);
    for (const [eventType, expected] of [
      ["Bounce", "bounced"],
      ["Complaint", "complained"],
      ["Reject", "rejected"],
    ] as const) {
      const verified = await relay.verifyWebhook({
        headers: {},
        body: signedBody({
          Message: JSON.stringify({ eventType, mail: { messageId: "m" } }),
        }),
      });
      const events = await relay.normalizeWebhook(verified);
      expect(events[0]?.type).toBe(expected);
    }
  });

  it("restricts signing certificate URLs", () => {
    expect(isAllowedSnsCertUrl("https://sns.us-east-1.amazonaws.com/x.pem")).toBe(true);
    expect(isAllowedSnsCertUrl("https://evil.example.com/x.pem")).toBe(false);
  });
});
