/**
 * IP warmup: a new sending IP has no reputation, so mailbox providers
 * throttle or spam-folder anything beyond a trickle. The standard answer is
 * a ramp — start at tens of messages a day and double daily until the target
 * volume is reached. Missing the ramp is the single most common way
 * self-hosters burn a fresh IP.
 */

export const WARMUP_START_CAP = 50;

/** Daily cap on a warmup day index: 50 → 100 → 200 → … until the target. */
export function warmupDailyCap(elapsedDays: number, targetDailyCap: number): number {
  const dayIndex = Math.max(0, Math.floor(elapsedDays));
  return Math.min(targetDailyCap, WARMUP_START_CAP * 2 ** dayIndex);
}

export interface WarmupState {
  startedAt: Date;
  days: number;
}

/**
 * The effective daily cap right now, or null when warmup is finished (or the
 * ramp state is incomplete). After `days` elapsed the relay runs at its
 * configured target, uncapped by warmup.
 */
export function currentWarmupCap(
  warmup: { startedAt: Date | null; days: number | null },
  targetDailyCap: number,
  now: Date = new Date(),
): number | null {
  if (warmup.startedAt === null || warmup.days === null) {
    return null;
  }
  const elapsedDays = (now.getTime() - warmup.startedAt.getTime()) / 86_400_000;
  if (elapsedDays >= warmup.days) {
    return null;
  }
  return warmupDailyCap(elapsedDays, targetDailyCap);
}
