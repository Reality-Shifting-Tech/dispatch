# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- M0 foundation: pnpm + Turborepo monorepo, strict TypeScript, ESLint flat
  config with a zero-warning policy, Vitest, and GitHub Actions CI.
- `@mailpelican/config`: Zod-validated environment configuration with fail-fast
  startup errors.
- `@mailpelican/db`: Drizzle schema with the `workspaces` table (UUIDv7 primary
  keys) and the initial migration.
- `@mailpelican/contracts`: RFC 9457 problem-details helpers and cursor
  pagination types.
- `apps/api`: Hono bootstrap, `/health/live` and `/health/ready`, `/v1` stub
  returning 501 problem details, graceful shutdown.
- `apps/worker`: BullMQ/Redis connection with heartbeat and graceful shutdown.
- `apps/web`: minimal Vite + React 19 stub.
- Docker: compose stack (PostgreSQL 16, Redis 7, all-in-one app image).
