import { describe, expect, it } from "vitest";
import { ConfigError, loadEnv } from "./index.js";

const validEnv = {
  APP_URL: "http://localhost:3000",
  PUBLIC_URL: "https://mail.example.com",
  TRACKING_URL: "https://track.example.com",
  DATABASE_URL: "postgres://dispatch:dispatch@localhost:5432/dispatch",
  REDIS_URL: "redis://localhost:6379",
  CREDENTIAL_ENCRYPTION_KEY: "a".repeat(32),
  SESSION_SECRET: "b".repeat(32),
};

describe("loadEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    const env = loadEnv(validEnv);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
  });

  it("coerces PORT from a string", () => {
    const env = loadEnv({ ...validEnv, PORT: "8080" });
    expect(env.PORT).toBe(8080);
  });

  it("rejects a non-URL APP_URL with a clear error", () => {
    expect(() => loadEnv({ ...validEnv, APP_URL: "not-a-url" })).toThrow(ConfigError);
    try {
      loadEnv({ ...validEnv, APP_URL: "not-a-url" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain("APP_URL");
    }
  });

  it("rejects a short encryption key", () => {
    expect(() => loadEnv({ ...validEnv, CREDENTIAL_ENCRYPTION_KEY: "short" })).toThrow(
      /CREDENTIAL_ENCRYPTION_KEY/,
    );
  });

  it("reports every missing variable at once", () => {
    try {
      loadEnv({});
      expect.unreachable();
    } catch (error) {
      const issues = (error as ConfigError).issues;
      const paths = issues.map((issue) => issue.path.join("."));
      for (const key of [
        "APP_URL",
        "PUBLIC_URL",
        "TRACKING_URL",
        "DATABASE_URL",
        "REDIS_URL",
        "CREDENTIAL_ENCRYPTION_KEY",
        "SESSION_SECRET",
      ]) {
        expect(paths).toContain(key);
      }
    }
  });
});
