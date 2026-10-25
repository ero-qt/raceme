import { formatClock } from "./format-time.ts";
import { type RaceState, standings } from "./race/race.ts";

interface ResultRow {
  place: number | null;
  name: string;
  result: "done" | "forfeit" | "racing";
  timeMs: number | null;
}

function rows(race: RaceState): ResultRow[] {
  return standings(race).map((standing) => ({
    place: standing.place,
    name: standing.name,
    result: standing.result?.kind ?? "racing",
    timeMs: standing.result?.kind === "done" ? standing.result.timeMs : null,
  }));
}

/** Builds the results as pretty-printed JSON. */
export function resultsJson(race: RaceState): string {
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  const results = { goal: race.goal, started: iso(race.startsAt), ended: iso(race.endedAt) };
  return `${JSON.stringify({ ...results, results: rows(race) }, null, 2)}\n`;
}

/** Builds the results as CSV with CRLF line ends, the line end RFC 4180 asks for. */
export function resultsCsv(race: RaceState): string {
  const header = "place,name,result,time,time_ms";
  const lines = rows(race).map((row) =>
    [
      row.place ?? "",
      csvField(row.name),
      row.result,
      row.timeMs === null ? "" : formatClock(row.timeMs, race.settings.fractionDigits),
      row.timeMs ?? "",
    ].join(","),
  );

  return `${[header, ...lines].join("\r\n")}\r\n`;
}

/**
 * Builds the results as plain text to paste into a chat: a `heading` line, the goal, one line per
 * place, then the entrants without a place grouped by status.
 */
export function resultsText(race: RaceState, heading: string): string {
  const placed = resultsImageRows(race).filter((row) => row.place !== "");
  const unplaced = resultsImageRows(race).filter((row) => row.place === "");
  const byStatus = Map.groupBy(unplaced, (row) => row.time);
  const lines = [
    heading,
    race.goal ?? "Race",
    ...placed.map((row) => `${row.place}. ${row.name} ${row.time}`),
    ...[...byStatus].map(
      ([status, rows]) => `${status}: ${rows.map((row) => row.name).join(", ")}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export interface ImageRow {
  place: string;
  name: string;
  /** Gives the finish time, else `Forfeit` or `Racing`. */
  time: string;
}

/** Gives the text of each row the results image draws, in standings order. */
export function resultsImageRows(race: RaceState): ImageRow[] {
  const statusText = { forfeit: "Forfeit", racing: "Racing" } as const;
  return rows(race).map((row) => ({
    place: row.place === null ? "" : String(row.place),
    name: row.name,
    time:
      row.result === "done" && row.timeMs !== null
        ? formatClock(row.timeMs, race.settings.fractionDigits)
        : statusText[row.result === "done" ? "racing" : row.result],
  }));
}

/** Builds the file name from the goal and the race date, like `raceme-any-2026-10-24.csv`. A race ended before GO takes its end date. */
export function exportFileName(race: RaceState, extension: "csv" | "json" | "png"): string {
  const goal = (race.goal ?? "race")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date(race.startsAt ?? race.endedAt ?? 0).toISOString().slice(0, 10);
  return `raceme-${goal || "race"}-${date}.${extension}`;
}

// Spreadsheet apps run a cell starting with one of these as a formula (CSV injection).
const formulaStart = /^[=+\-@\t\r]/;

function csvField(value: string): string {
  const defused = formulaStart.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(defused) ? `"${defused.replaceAll('"', '""')}"` : defused;
}
