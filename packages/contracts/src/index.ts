import { z } from "zod";

/**
 * RFC 9457 problem-details error envelope. Every non-2xx API response uses
 * this shape so clients can rely on a single error contract.
 */
export const problemDetailsSchema = z.object({
  type: z.string().url().default("about:blank"),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

const DEFAULT_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
};

export function problem(input: {
  status: number;
  title?: string;
  detail?: string;
  type?: string;
  instance?: string;
}): ProblemDetails {
  const title = input.title ?? DEFAULT_TITLES[input.status] ?? "Error";
  return problemDetailsSchema.parse({
    type: input.type ?? "about:blank",
    title,
    status: input.status,
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    ...(input.instance !== undefined ? { instance: input.instance } : {}),
  });
}

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/**
 * Cursor-based pagination. Cursors are opaque to clients: base64url-encoded
 * JSON payloads. Internal fields are validated on decode.
 */
export const cursorSchema = z.object({
  /** Last seen primary key, exclusive lower bound for the next page. */
  after: z.string().min(1),
});

export type Cursor = z.infer<typeof cursorSchema>;

export interface CursorPage<T> {
  data: T[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(encoded: string): Cursor {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid cursor encoding");
  }
  const result = cursorSchema.safeParse(raw);
  if (!result.success) {
    throw new Error("Invalid cursor payload");
  }
  return result.data;
}
