# AGENTS.md

Guidance for AI agents working in this repository. Human-facing contribution
rules live in [CONTRIBUTING.md](CONTRIBUTING.md); this file is the operational
quick-reference. Where the two overlap, CONTRIBUTING wins.

## What this is

dispatch is an AGPL-3.0, self-hostable, agent-native email marketing platform
(Mailchimp alternative). TypeScript ESM monorepo: pnpm 10 workspaces + Turbo.
Currently at milestone M1 ("first safe send") — see `docs/adr/` for decisions.

## Toolchain

- Node >= 22 (`.nvmrc` pins 24), pnpm >= 10 (`packageManager: pnpm@10.10.0`).
- Docker for local PostgreSQL 16 + Redis; **not** required for the default test
  suite (tests use PGlite in-process Postgres).

## Commands

Run from the repo root unless noted.

```bash
pnpm install
pnpm build            # turbo run build (all packages/apps)
pnpm dev              # api on :3000, web on :5173, worker
pnpm lint             # eslint . --max-warnings 0 (warnings fail)
pnpm format:check     # prettier --check .
pnpm typecheck        # turbo run typecheck
pnpm test             # turbo run test (vitest run per package)
```

Full pre-push gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Agent tooling (MCP)

This project needs no MCP servers — the work is plain TypeScript + pnpm +
Drizzle. `.kimi-code/mcp.json` disables the user-level servers (blender,
conway, cua-driver, motion-previs, revenuecat, tiktok_ads, xcodebuildmcp,
zoho_inventory) for this repo only, to keep the agent's context small; the
global config is untouched and other projects are unaffected. If a task ever
needs one of them, flip its entry to `true` for that session. Plugin-provided
servers (e.g. Vercel) are managed separately via `/plugins`.

Scoped work: `pnpm --filter @dispatch/db <script>` (e.g. `migrate`, `generate`).
Package names are `@dispatch/<name>`; apps are filtered by directory name
(e.g. `pnpm --filter api`).

Local infrastructure:

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

Required env vars (schema in `packages/config`): `APP_URL`, `PUBLIC_URL`,
`TRACKING_URL`, `DATABASE_URL`, `REDIS_URL`, `CREDENTIAL_ENCRYPTION_KEY`,
`SESSION_SECRET`. One-time setup: `pnpm --filter @dispatch/db migrate`, then
`pnpm --filter @dispatch/api bootstrap "Workspace" "Org" "Address"` — the
bootstrap prints the owner API key exactly once.

Docker-based testcontainers suite only runs when a Docker daemon is present
and `DISPATCH_DOCKER_TESTS=1` is set; don't enable it casually.

## Layout

```
apps/
  api/      Hono REST API under /v1, OpenAPI, API-key auth (Bearer dk_...)
  mcp/      MCP server (stdio) exposing the /v1 surface to agents
  web/      Vite + React 19 control surface (stub)
  worker/   BullMQ worker: send pipeline, webhook normalization, scheduler
packages/
  config/     env schema
  db/         Drizzle ORM schema, migrations, repositories (PostgreSQL 16)
  domain/     state machines, consent decisions, tokens, merge tags, retry
  contracts/  API conventions: RFC 9457 problem details, cursor pagination
  relays/     RelayProvider contract + SES v2 / Resend / SMTP drivers
  render/     React Email design documents → HTML/text artifacts (ADR-0002)
  queue/      job contracts, outbox dispatcher, rate limiters
  testkit/    fake relay, controlled clock
docker/     compose for local dev + all-in-one image
docs/adr/   architecture decision records
```

Dependency direction: apps depend on packages; `domain` and `contracts` are
the low-level shared core. Check an ADR before reversing or adding edges.

## Conventions (enforced in review/CI)

- Conventional Commits: `<type>(<scope>): <imperative summary>`; types
  `feat|fix|chore|docs|refactor|test|ci|build|perf`, scope = package/app name.
  The changelog is generated from these messages.
- Strict TypeScript; `any` is banned by lint. Zero-warning lint policy.
- New behavior ships with tests. Unit tests are Vitest, must not require live
  infrastructure — inject dependencies (pattern: `apps/api/src/app.test.ts`).
  Use `packages/testkit` (fake relay, controlled clock) instead of real
  timers/relays.
- Every non-2xx API response uses the problem-details envelope from
  `@dispatch/contracts`.
- Style bar is "edited, not generated": no narrating comments (comment the
  why or nothing), no dead code, no speculative abstractions beyond what the
  current milestone requires, reuse existing vocabulary.
- Chat replies use the `caveman` skill in `lite` mode (drop filler and
  hedging, keep full sentences). Repo artifacts are exempt and stay standard
  professional English: commit messages, PR bodies, code comments, docs,
  ADRs, and this file.
- One logical change per PR; keep diffs reviewable (~400 lines of substance).

## Working agreement for agents

- Never commit or push unless explicitly asked.
- Email sending has real-world side effects: never trigger sends against live
  relays or production data; use `testkit`'s fake relay in tests and local dev.
- Consent/suppression logic (`packages/domain`, worker send pipeline) is
  safety-critical — changes there need tests and a clear why in the PR body.
