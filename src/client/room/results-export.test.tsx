import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@solidjs/testing-library";
import type { RaceState } from "../../shared/race/race.ts";
import { ResultsExport } from "./results-export.tsx";

afterEach(cleanup);

const race: RaceState = {
  phase: "finished",
  goal: "any%",
  settings: { countdownMs: 10_000, fractionDigits: 0 },
  startsAt: 0,
  endedAt: 60_000,
  entrants: [{ id: "a", name: "alice", ready: true, result: { kind: "done", timeMs: 60_000 } }],
};

describe("ResultsExport", () => {
  test("offers native download links for JSON and CSV", () => {
    const view = render(() => <ResultsExport race={race} />);
    const csv = view.getByRole("link", { name: "download .csv" }) as HTMLAnchorElement;
    const json = view.getByRole("link", { name: "download .json" }) as HTMLAnchorElement;
    expect(csv.download).toBe("raceme-any-1970-01-01.csv");
    expect(json.download).toBe("raceme-any-1970-01-01.json");
  });
});
