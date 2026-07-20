import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApi, loadApiKey, storeApiKey, clearApiKey, ApiError } from "./api.js";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return calls;
}

describe("api client", () => {
  it("round-trips the stored key", () => {
    expect(loadApiKey()).toBeNull();
    storeApiKey("dk_test");
    expect(loadApiKey()).toBe("dk_test");
    clearApiKey();
    expect(loadApiKey()).toBeNull();
  });

  it("sends the bearer key and builds cursor URLs", async () => {
    const calls = stubFetch(200, { data: [], pageInfo: { nextCursor: null, hasNextPage: false } });
    storeApiKey("dk_abc");
    const api = createApi(loadApiKey, () => {});
    await api.listCampaigns("cursor-1");
    expect(calls[0]?.url).toBe("/v1/campaigns?limit=50&cursor=cursor-1");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer dk_abc");
  });

  it("maps problem details to ApiError", async () => {
    stubFetch(404, { status: 404, detail: "Campaign not found." });
    const api = createApi(loadApiKey, () => {});
    const failure = await api.campaignStats("x").catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(404);
    expect((failure as ApiError).message).toBe("Campaign not found.");
  });

  it("clears the key and notifies on 401", async () => {
    stubFetch(401, { status: 401, detail: "unauthorized" });
    storeApiKey("dk_stale");
    let notified = false;
    const api = createApi(loadApiKey, () => {
      notified = true;
    });
    await api.listLists(null).catch(() => {});
    expect(loadApiKey()).toBeNull();
    expect(notified).toBe(true);
  });
});
