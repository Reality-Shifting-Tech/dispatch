# dispatch 📨

> The open-source, self-hostable, agent-native email marketing platform.

![Status: early development](https://img.shields.io/badge/status-early%20development-orange)

dispatch is an AGPL-3.0 Mailchimp alternative designed from the ground up for
self-hosters and for AI agents as first-class operators. It is currently at
milestone **M0**: monorepo foundation, tooling, configuration, database base,
and health endpoints. There is no product surface yet.

## Quickstart

Prerequisites: Node 24 (>= 22 works locally), pnpm 10, Docker.

```bash
# Start PostgreSQL and Redis
docker compose -f docker/docker-compose.yml up -d postgres redis

# Configure the environment (see packages/config for the full schema)
export APP_URL=http://localhost:3000 \
       PUBLIC_URL=http://localhost:3000 \
       TRACKING_URL=http://localhost:3000 \
       DATABASE_URL=postgres://dispatch:dispatch@localhost:5432/dispatch \
       REDIS_URL=redis://localhost:6379 \
       CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32) \
       SESSION_SECRET=$(openssl rand -hex 32)

pnpm install
pnpm build
pnpm --filter @dispatch/db migrate   # apply database migrations
pnpm dev                             # api on :3000, web on :5173, worker
```

A full all-in-one container (API + worker + web static bundle) is available via
`docker compose -f docker/docker-compose.yml up --build app`. The image runs
`pnpm build` internally, so no local build artifacts are required.

## Repository layout

```
apps/
  api/        Hono REST API under /v1, health endpoints, graceful shutdown
  web/        Vite + React 19 control surface (stub)
  worker/     BullMQ worker process (heartbeat only, no jobs yet)
packages/
  config/     Zod-validated environment configuration, fail-fast
  db/         Drizzle ORM schema, migrations, and client (PostgreSQL 16)
  contracts/  API conventions: RFC 9457 problem details, cursor pagination
docker/       docker-compose for local dev and the all-in-one image
docs/adr/     Architecture decision records
```

## Use with AI agents

dispatch is being built agent-native: every operation the UI exposes will also
be reachable by automation. A first-class MCP server is planned for an upcoming
milestone; watch this space.

## Documentation

- [Architecture decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[AGPL-3.0](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
