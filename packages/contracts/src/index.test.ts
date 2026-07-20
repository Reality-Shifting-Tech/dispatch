import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, problem, problemDetailsSchema } from "./index.js";

describe("problem", () => {
  it("builds an RFC 9457 envelope with a default title", () => {
    const body = problem({ status: 404, detail: "workspace ws_123 not found" });
    expect(body).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "workspace ws_123 not found",
    });
  });

  it("accepts an explicit title and type", () => {
    const body = problem({
      status: 422,
      title: "Validation Failed",
      type: "https://dispatch.dev/problems/validation",
    });
    expect(problemDetailsSchema.parse(body)).toMatchObject({
      title: "Validation Failed",
      type: "https://dispatch.dev/problems/validation",
    });
  });

  it("rejects non-error statuses", () => {
    expect(() => problem({ status: 200 })).toThrow();
  });
});

describe("cursors", () => {
  it("round-trips a cursor", () => {
    const encoded = encodeCursor({ after: "0190abcd-0000-7000-8000-000000000000" });
    expect(decodeCursor(encoded)).toEqual({ after: "0190abcd-0000-7000-8000-000000000000" });
  });

  it("rejects malformed encodings", () => {
    expect(() => decodeCursor("not-base64!!")).toThrow("Invalid cursor");
  });

  it("rejects payloads that fail schema validation", () => {
    const encoded = Buffer.from(JSON.stringify({ after: "" }), "utf8").toString("base64url");
    expect(() => decodeCursor(encoded)).toThrow("Invalid cursor payload");
  });
});
