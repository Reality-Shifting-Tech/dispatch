# ADR-0003: Relay-agnostic sending, no built-in MTA

- Status: Accepted
- Date: 2025-06-01

## Context

Deliverability is an operational discipline (IP warmup, reputation, bounce
handling, feedback loops) that mature providers already solve. Embedding a
mail transfer agent inside dispatch would couple our release cadence to the
hardest part of email infrastructure and mislead self-hosters into thinking
deliverability comes free with the software.

## Decision

dispatch sends through external relays behind a provider interface (SES,
Postmark, Mailgun, Resend, generic SMTP). We do not ship, bundle, or recommend
a built-in MTA. Provider credentials are stored encrypted at rest
(`CREDENTIAL_ENCRYPTION_KEY`); bounce and complaint webhooks normalize into a
single internal event stream.

## Consequences

Self-hosters must bring a sending provider; the README and setup flow must
make that requirement unmissable. In return, the sending layer stays small,
testable against a fake relay, and free to support new providers without
touching campaign logic.
