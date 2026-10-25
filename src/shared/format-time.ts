export type FractionDigits = 0 | 1 | 2 | 3;

/**
 * Formats ms as `HH:MM:SS` like SRL's RaceBot, plus up to 3 fraction digits. Positive times cut
 * off the rest, negative times round away from zero so a countdown never shows `-00:00:00`.
 */
export function formatClock(ms: number, digits: FractionDigits = 0): string {
  const unitMs = 10 ** (3 - digits);
  const units = ms < 0 ? Math.ceil(-ms / unitMs) : Math.floor(ms / unitMs);
  const totalMs = units * unitMs;

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const clock = `${ms < 0 ? "-" : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return clock + formatFraction(totalMs, digits);
}

/** Formats the fraction part of a time like `.43`. Whole seconds give `""`. */
export function formatFraction(ms: number, digits: FractionDigits): string {
  if (digits === 0) {
    return "";
  }

  const unitMs = 10 ** (3 - digits);
  const units = Math.floor((Math.abs(ms) % 1000) / unitMs);
  return `.${String(units).padStart(digits, "0")}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
