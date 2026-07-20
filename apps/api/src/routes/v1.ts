import { PROBLEM_CONTENT_TYPE, problem } from "@dispatch/contracts";
import { Hono } from "hono";

/**
 * Versioned API surface. Route modules are mounted here as they land; until
 * then every /v1 path answers 501 so the contract is explicit, not implicit 404.
 */
export function v1Routes() {
  const routes = new Hono();

  routes.all("*", (c) => {
    return c.json(problem({ status: 501, detail: "This endpoint is not implemented yet." }), 501, {
      "content-type": PROBLEM_CONTENT_TYPE,
    });
  });

  return routes;
}
