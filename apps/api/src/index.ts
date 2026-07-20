import { serve } from "@hono/node-server";
import { loadEnv } from "@dispatch/config";
import { closeDb, createDb } from "@dispatch/db";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { createApp } from "./app.js";
import type { Deps } from "./deps.js";

const env = loadEnv();

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

const deps: Deps = {
  env,
  checkDatabase: async () => {
    await db.execute(sql`SELECT 1`);
  },
  checkRedis: async () => {
    await redis.ping();
  },
  close: async () => {
    await closeDb(db);
    redis.disconnect();
  },
};

const app = createApp(deps);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});

async function shutdown(signal: string) {
  console.log(`received ${signal}, shutting down`);
  server.close();
  await deps.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
