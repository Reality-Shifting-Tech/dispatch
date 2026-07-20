import { SESv2Client } from "@aws-sdk/client-sesv2";
import { Resend } from "resend";
import type { RelayTypeValue } from "@mailpelican/db";
import type { RelayProvider } from "./types.js";
import { isAllowedSnsCertUrl, SesRelay, type SesCredentials } from "./ses.js";
import { ResendRelay, type ResendClientLike, type ResendCredentials } from "./resend.js";
import { createSmtpRelay, type SmtpCredentials } from "./smtp.js";

/**
 * Build a RelayProvider for a stored relay row and its decrypted credential
 * JSON. The Resend webhook (Svix) secret lives in `config.webhookSecret`.
 */
export function createRelayProvider(
  type: RelayTypeValue,
  credentialsJson: string,
  config: Record<string, unknown> = {},
): RelayProvider {
  switch (type) {
    case "ses": {
      const credentials = JSON.parse(credentialsJson) as SesCredentials;
      const client = new SESv2Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });
      return new SesRelay(client, credentials.configurationSetName, fetchSnsCertificate);
    }
    case "resend": {
      const credentials = JSON.parse(credentialsJson) as ResendCredentials;
      const webhookSecret =
        typeof config.webhookSecret === "string" ? config.webhookSecret : credentials.apiKey;
      const client = new Resend(credentials.apiKey) as unknown as ResendClientLike;
      return new ResendRelay(client, webhookSecret);
    }
    case "smtp": {
      const credentials = JSON.parse(credentialsJson) as SmtpCredentials;
      return createSmtpRelay(credentials);
    }
  }
}

/**
 * Fetch the SNS signing certificate, restricting the URL to the documented
 * amazonaws.com pattern to avoid SSRF through a forged SigningCertURL.
 */
async function fetchSnsCertificate(url: string): Promise<string> {
  if (!isAllowedSnsCertUrl(url)) {
    throw new Error("Untrusted SNS signing certificate URL");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch SNS certificate: ${response.status}`);
  }
  return response.text();
}
