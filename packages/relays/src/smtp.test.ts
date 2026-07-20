import { describe, expect, it, vi } from "vitest";
import { SmtpRelay } from "./smtp.js";
import type { PreparedMessage } from "./types.js";

const message: PreparedMessage = {
  messageId: "018e0f5e-0000-7000-8000-000000000003",
  fromEmail: "news@example.com",
  fromName: "News",
  replyTo: null,
  toEmail: "user@example.org",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  headers: { "List-Unsubscribe": "<https://example.com/unsub/abc>" },
};

const context = { workspaceId: "w", relayId: "r", campaignId: "c" };

describe("SmtpRelay", () => {
  it("advertises send-only capabilities", () => {
    const relay = new SmtpRelay({ sendMail: vi.fn(), verify: vi.fn() } as never);
    expect(relay.capabilities).toEqual({
      providerIdempotency: false,
      deliveryEvents: false,
      bounceEvents: false,
      complaintEvents: false,
      scheduling: false,
    });
  });

  it("sends mail and reports the MTA message id", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "<mta-1@example.com>" });
    const relay = new SmtpRelay({ sendMail, verify: vi.fn() } as never);
    const result = await relay.send(message, context);
    expect(result.providerMessageId).toBe("<mta-1@example.com>");
    const input = sendMail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input.headers).toEqual(message.headers);
  });

  it("never verifies webhooks", async () => {
    const relay = new SmtpRelay({ sendMail: vi.fn(), verify: vi.fn() } as never);
    expect((await relay.verifyWebhook()).valid).toBe(false);
    expect(await relay.normalizeWebhook()).toEqual([]);
  });

  it("checks connectivity via transporter verify", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const relay = new SmtpRelay({ sendMail: vi.fn(), verify } as never);
    expect((await relay.testConnection()).ok).toBe(true);
  });
});
