import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

/**
 * Structural database handle shared by the node-postgres pool (production)
 * and PGlite (tests). Repositories and services accept this type so both
 * drivers run the same code.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type PooledDatabase = NodePgDatabase<typeof schema> & { $client: pg.Pool };

export function createDb(connectionString: string): PooledDatabase {
  const pool = new pg.Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

export async function closeDb(db: PooledDatabase): Promise<void> {
  await db.$client.end();
}
