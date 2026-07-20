# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities.

Email security reports to **security@dispatch.dev** (placeholder until the
project domain is live; for now, open a private GitHub security advisory on
the repository). Include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof of concept
- Affected versions or commits

We aim to acknowledge reports within 72 hours and to keep you informed as we
investigate and fix.

## Scope

dispatch handles email credentials, contact data, and sending infrastructure.
Issues involving credential storage (`CREDENTIAL_ENCRYPTION_KEY` usage),
session handling, webhook authentication, and injection of any kind are
treated as high priority.

## Supported versions

dispatch is pre-release. Only the latest commit on the default branch receives
security fixes until the first stable version is published.
