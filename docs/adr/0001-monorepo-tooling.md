# ADR-0001: Monorepo and tooling foundation

- Status: Accepted
- Date: 2025-06-01

## Context

dispatch ships three deployable processes (API, web, worker) plus shared
libraries (config, db, contracts) that must evolve in lockstep — the API
contract and the database schema especially. Coordinating versions across
separate repositories adds release overhead with no compensating benefit at
our scale.

## Decision

Use a pnpm workspaces monorepo with Turborepo orchestrating build, typecheck,
lint, and test tasks. TypeScript runs in strict mode with NodeNext module
resolution, ESM everywhere, and a shared `tsconfig.base.json`. ESLint (flat
config, typescript-eslint) and Prettier enforce a zero-warning policy in CI.
Node 24 is the target runtime; engines accept >= 22 for local development.

## Consequences

One checkout, one install, one CI pipeline. Cross-package refactors land in a
single commit. The cost is that tooling configuration (turbo tasks, per-package
tsconfigs) is part of the codebase and must be maintained with the same care
as product code.
