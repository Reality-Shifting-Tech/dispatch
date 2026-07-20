import nodemailer, { type Transporter } from "nodemailer";
import type {
  PreparedMessage,
  RelayCapabilities,
  RelayHealth,
  RelayProvider,
  SendContext,
  SendResult,
  VerifiedWebhook,
} from "./types.js";

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
}

const CAPABILITIES: RelayCapabilities = {
  providerIdempotency: false,
  deliveryEvents: false,
  bounceEvents: false,
  complaintEvents: false,
  scheduling: false,
};

/**
 * Generic SMTP driver (architecture §8): send-only via nodemailer. It
 * advertises no feedback capabilities and never infers delivery status —
 * accepted by the MTA is the last thing we can honestly claim.
 */
export class SmtpRelay implements RelayProvider {
  readonly type = "smtp" as const;
  readonly capabilities = CAPABILITIES;

  private readonly transporter: Transporter;

  constructor(transporter: Transporter) {
    this.transporter = transporter;
  }

  async testConnection(): Promise<RelayHealth> {
    try {
      await this.transporter.verify();
      return { ok: true, detail: "smtp connection verified" };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : "unknown error" };
    }
  }

  async send(message: PreparedMessage, _context: SendContext): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      messageId: `<${message.messageId}@dispatch>`,
      from: `${message.fromName} <${message.fromEmail}>`,
      to: message.toEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo !== null ? { replyTo: message.replyTo } : {}),
      headers: message.headers,
    });
    const messageId = typeof info.messageId === "string" ? info.messageId : null;
    return { providerMessageId: messageId };
  }

  async verifyWebhook(): Promise<VerifiedWebhook> {
    return { valid: false, reason: "smtp relays do not receive webhooks" };
  }

  async normalizeWebhook() {
    return [];
  }
}

/** Construct the production driver from stored credentials. */
export function createSmtpRelay(credentials: SmtpCredentials): SmtpRelay {
  const transporter = nodemailer.createTransport({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.secure,
    ...(credentials.username !== undefined
      ? { auth: { user: credentials.username, pass: credentials.password ?? "" } }
      : {}),
  });
  return new SmtpRelay(transporter);
}
