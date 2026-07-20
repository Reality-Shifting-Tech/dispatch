import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { Deps } from "./deps.js";

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      PUBLIC_URL: "https://mail.example.com",
      TRACKING_URL: "https://track.example.com",
      DATABASE_URL: "postgres://localhost/dispatch",
      REDIS_URL: "redis://localhost:6379",
      CREDENTIAL_ENCRYPTION_KEY: "a".repeat(32),
      SESSION_SECRET: "b".repeat(32),
      PORT: 3000,
    },
    checkDatabase: async () => {},
    checkRedis: async () => {},
    close: async () => {},
    ...overrides,
  };
}

describe("app", () => {
  it("answers liveness without touching dependencies", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/health/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("reports readiness when dependencies are healthy", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/health/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("returns 503 when a dependency check fails", async () => {
    const app = createApp(
      makeDeps({
        checkRedis: async () => {
          throw new Error("connection refused");
        },
      }),
    );
    const res = await app.request("/health/ready");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "error", checks: { database: "ok", redis: "error" } });
  });

  it("answers 501 with a problem-details body under /v1", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/v1/contacts");
    expect(res.status).toBe(501);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(await res.json()).toMatchObject({ status: 501, title: "Not Implemented" });
  });

  it("answers unknown routes with a problem-details 404", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ status: 404, title: "Not Found" });
  });
});
