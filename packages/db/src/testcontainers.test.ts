/**
 * Server-PostgreSQL smoke test. Runs only when Docker is available and
 * MAILPELICAN_DOCKER_TESTS=1 is set; the default suite uses PGlite instead.
 * Skipping here keeps `pnpm test` green on machines without a Docker daemon.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dockerAvailable = (() => {
  if (process.env.MAILPELICAN_DOCKER_TESTS !== "1") {
    return false;
  }
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(dockerAvailable)("postgres via testcontainers", () => {
  it("applies migrations and round-trips a workspace", async () => {
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    try {
      const url = container.getConnectionUri();
      const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
      const { createDb, closeDb } = await import("./client.js");
      const db = createDb(url);
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder: migrationsDir });
      const { workspaces } = await import("./schema.js");
      const { uuidv7 } = await import("./uuidv7.js");
      const id = uuidv7();
      await db.insert(workspaces).values({
        id,
        name: "TC",
        slug: `tc-${id.slice(0, 8)}`,
        organizationName: "TC Inc",
        postalAddress: "1 Main St",
      });
      const rows = await db.select().from(workspaces);
      expect(rows.some((r) => r.id === id)).toBe(true);
      await closeDb(db);
    } finally {
      await container.stop();
    }
  }, 120_000);
});
