import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import type { RaceState } from "../../shared/race/race.ts";
import { resultsCsv } from "../../shared/results.ts";
import { ResultsExport } from "./results-export.tsx";

afterEach(cleanup);

const race: RaceState = {
  phase: "finished",
  goal: "any%",
  settings: { countdownMs: 10_000, fractionDigits: 0, entrantCap: null },
  startsAt: 0,
  endedAt: 60_000,
  muted: [],
  entryLocked: false,
  entrants: [{ id: "a", name: "alice", ready: true, result: { kind: "done", timeMs: 60_000 } }],
};

describe("ResultsExport", () => {
  test("offers text to select, CSV and JSON to download, and the image to copy or download", () => {
    const view = render(() => <ResultsExport race={race} />);
    const buttons = view.getAllByRole("button").map((button) => button.getAttribute("aria-label"));

    expect(buttons).toEqual(["download csv", "download json", "copy image", "download image"]);
    for (const name of ["text", "csv", "json", "image"]) {
      expect(view.getByText(name, { selector: "summary" })).toBeTruthy();
    }
  });

  test("opening CSV shows the read-only text, all selected", async () => {
    const view = render(() => <ResultsExport race={race} />);
    const details = view.getByText("csv", { selector: "summary" })
      .parentElement as HTMLDetailsElement;

    details.open = true;
    fireEvent(details, new Event("toggle"));
    const csv = (await view.findByLabelText("results as csv")) as HTMLTextAreaElement;
    fireEvent.focus(csv);

    expect(csv.readOnly).toBe(true);
    expect(csv.value).toBe(resultsCsv(race));
    expect([csv.selectionStart, csv.selectionEnd]).toEqual([0, csv.value.length]);
  });

  test("highlights up to 10 places, never more than finished", () => {
    const view = render(() => <ResultsExport race={race} />);

    expect((view.getByLabelText("places to highlight") as HTMLInputElement).value).toBe("1");
  });
});
