import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema.js";
import type { Database } from "./client.js";

/**
 * Create an isolated in-process PostgreSQL (PGlite) with all migrations
 * applied. Used by repository and integration tests so the suite runs
 * without a Docker daemon; Testcontainers-based runs exercise the same code
 * against a server PostgreSQL in CI.
 */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;
  await migrate(db, { migrationsFolder });
  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}
