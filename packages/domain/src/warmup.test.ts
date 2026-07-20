import { describe, expect, it } from "vitest";
import { currentWarmupCap, warmupDailyCap, WARMUP_START_CAP } from "./warmup.js";

describe("warmupDailyCap", () => {
  it("starts at the floor and doubles daily to the target", () => {
    expect(warmupDailyCap(0, 10_000)).toBe(WARMUP_START_CAP);
    expect(warmupDailyCap(1, 10_000)).toBe(100);
    expect(warmupDailyCap(2, 10_000)).toBe(200);
    expect(warmupDailyCap(0.9, 10_000)).toBe(WARMUP_START_CAP);
    expect(warmupDailyCap(20, 10_000)).toBe(10_000);
  });
});

describe("currentWarmupCap", () => {
  const startedAt = new Date("2026-07-01T00:00:00Z");

  it("caps during the ramp and releases after it", () => {
    expect(
      currentWarmupCap({ startedAt, days: 14 }, 10_000, new Date("2026-07-02T00:00:00Z")),
    ).toBe(100);
    expect(
      currentWarmupCap({ startedAt, days: 14 }, 10_000, new Date("2026-07-15T00:00:00Z")),
    ).toBeNull();
  });

  it("is null when warmup is off or incomplete", () => {
    expect(currentWarmupCap({ startedAt: null, days: 14 }, 10_000)).toBeNull();
    expect(currentWarmupCap({ startedAt, days: null }, 10_000)).toBeNull();
  });
});
