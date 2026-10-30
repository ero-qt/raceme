import { describe, expect, test } from "bun:test";
import type { RaceState } from "./race/race.ts";
import {
  exportFileName,
  resultsCsv,
  resultsImageRows,
  resultsJson,
  resultsText,
} from "./results.ts";

const race: RaceState = {
  phase: "finished",
  goal: "sm64 16 star",
  settings: { countdownMs: 10_000, fractionDigits: 2, entrantCap: null },
  startsAt: Date.UTC(2026, 9, 24, 18, 0, 0),
  endedAt: Date.UTC(2026, 9, 24, 18, 20, 0),
  muted: [],
  entryLocked: false,
  entrants: [
    { id: "b", name: "bob", ready: true, result: { kind: "forfeit" } },
    { id: "a", name: "alice", ready: true, result: { kind: "done", timeMs: 1_065_439 } },
    {
      id: "c",
      name: '=HYPERLINK("x"), "hi"',
      ready: true,
      result: { kind: "done", timeMs: 1_100_000 },
    },
  ],
};

describe("resultsCsv", () => {
  test("lists places, names, results and times in standings order", () => {
    const lines = resultsCsv(race).trim().split("\r\n");

    expect(lines[0]).toBe("place,name,result,time,time_ms");
    expect(lines[1]).toBe("1,alice,done,00:17:45.43,1065439");
    expect(lines[3]).toBe(",bob,forfeit,,");
  });

  // Spreadsheets run a cell starting with = + - @ as a formula, so such racer names get a quote.
  test("quotes and defuses names that a spreadsheet would run as formulas", () => {
    const line = resultsCsv(race).trim().split("\r\n")[2];

    expect(line).toBe(`2,"'=HYPERLINK(""x""), ""hi""",done,00:18:20.00,1100000`);
  });
});

describe("resultsJson", () => {
  test("holds the goal, times and standings", () => {
    expect(JSON.parse(resultsJson(race))).toEqual({
      goal: "sm64 16 star",
      started: "2026-10-24T18:00:00.000Z",
      ended: "2026-10-24T18:20:00.000Z",
      results: [
        { place: 1, name: "alice", result: "done", timeMs: 1_065_439 },
        { place: 2, name: '=HYPERLINK("x"), "hi"', result: "done", timeMs: 1_100_000 },
        { place: null, name: "bob", result: "forfeit", timeMs: null },
      ],
    });
  });
});

describe("resultsText", () => {
  test("gives the goal, one line per place and the rest by status, to paste into a chat", () => {
    expect(resultsText(race, "-# [raceme](https://example.com/) · 10/24/2026 6:00 PM")).toBe(
      [
        "-# [raceme](https://example.com/) · 10/24/2026 6:00 PM",
        "sm64 16 star",
        "1. alice 00:17:45.43",
        '2. =HYPERLINK("x"), "hi" 00:18:20.00',
        "Forfeit: bob",
        "",
      ].join("\n"),
    );
  });
});

describe("resultsImageRows", () => {
  test("gives the text of each row the image draws, in standings order", () => {
    expect(resultsImageRows(race)).toEqual([
      { place: "1", name: "alice", time: "00:17:45.43" },
      { place: "2", name: '=HYPERLINK("x"), "hi"', time: "00:18:20.00" },
      { place: "", name: "bob", time: "Forfeit" },
    ]);
  });
});

describe("exportFileName", () => {
  test("uses the goal and the date, file-name safe", () => {
    expect(exportFileName(race, "csv")).toBe("raceme-sm64-16-star-2026-10-24.csv");
  });

  test("a race ended before GO takes its end date", () => {
    const ended = { ...race, phase: "terminated" as const, startsAt: null };

    expect(exportFileName(ended, "json")).toBe("raceme-sm64-16-star-2026-10-24.json");
  });
});
