export * from "./types.js";
export { SesRelay, buildRawMime, isAllowedSnsCertUrl, snsSigningString } from "./ses.js";
export type { SesClientLike, SesCredentials } from "./ses.js";
export { ResendRelay, ResendSendError } from "./resend.js";
export type { ResendClientLike, ResendCredentials } from "./resend.js";
export { SmtpRelay, createSmtpRelay } from "./smtp.js";
export type { SmtpCredentials } from "./smtp.js";
export { createRelayProvider } from "./registry.js";
