import { PROBLEM_CONTENT_TYPE, problem } from "@dispatch/contracts";
import { Hono } from "hono";
import type { Deps } from "./deps.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1.js";

export function createApp(deps: Deps) {
  const app = new Hono();

  app.route("/health", healthRoutes(deps));
  app.route("/v1", v1Routes());

  app.notFound((c) => {
    return c.json(problem({ status: 404, detail: "Route not found." }), 404, {
      "content-type": PROBLEM_CONTENT_TYPE,
    });
  });

  app.onError((error, c) => {
    console.error("unhandled error", error);
    return c.json(problem({ status: 500 }), 500, { "content-type": PROBLEM_CONTENT_TYPE });
  });

  return app;
}
