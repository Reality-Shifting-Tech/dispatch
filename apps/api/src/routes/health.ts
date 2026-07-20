import { Hono } from "hono";
import type { Deps } from "../deps.js";

export function healthRoutes(deps: Deps) {
  const routes = new Hono();

  routes.get("/live", (c) => c.json({ status: "ok" }));

  routes.get("/ready", async (c) => {
    const checks = { database: "ok", redis: "ok" };
    try {
      await deps.checkDatabase();
    } catch {
      checks.database = "error";
    }
    try {
      await deps.checkRedis();
    } catch {
      checks.redis = "error";
    }
    const healthy = checks.database === "ok" && checks.redis === "ok";
    return c.json({ status: healthy ? "ok" : "error", checks }, healthy ? 200 : 503);
  });

  return routes;
}
