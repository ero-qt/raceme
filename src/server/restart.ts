const dayMs = 24 * 60 * 60_000;

/** Finds the next time the clock reaches `hourUtc`, strictly after `now`. */
export function nextRestartAt(now: number, hourUtc: number): number {
  const today = new Date(now);
  const at = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hourUtc);
  return at > now ? at : at + dayMs;
}
