import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
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

describe("resultsExport", () => {
  test("offers text to select, CSV and JSON to download, and the image to copy or download", () => {
    const view = render(() => <ResultsExport race={race} />);
    const buttons = view.getAllByRole("button").map((button) => button.getAttribute("aria-label"));

    expect(buttons).toEqual(["download CSV", "download JSON", "copy image", "download image"]);
    for (const name of ["text", "CSV", "JSON", "image"]) {
      expect(view.getByText(name, { selector: "summary" })).toBeTruthy();
    }
  });

  test("a copy's result is announced, not only shown on the button", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: async () => {} },
    });
    const view = render(() => <ResultsExport race={race} />);

    fireEvent.click(view.getByRole("button", { name: "copy image" }));

    await waitFor(() =>
      expect(view.getByRole("status").textContent).toMatch(/^image (copied|failed)$/),
    );
  });

  test("opening CSV shows the read-only text, all selected", async () => {
    const view = render(() => <ResultsExport race={race} />);
    const details = view.getByText("CSV", { selector: "summary" })
      .parentElement as HTMLDetailsElement;

    details.open = true;
    fireEvent(details, new Event("toggle"));
    const csv = (await view.findByLabelText("results as CSV")) as HTMLTextAreaElement;
    fireEvent.focus(csv);

    expect(csv.readOnly).toBe(true);
    expect(csv.value).toBe(resultsCsv(race));
    expect([csv.selectionStart, csv.selectionEnd]).toEqual([0, csv.value.length]);
  });

  test("lists up to 10 places in the image, never more than the race has", () => {
    const view = render(() => <ResultsExport race={race} />);
    const field = view.getByLabelText("places to show") as HTMLInputElement;

    expect(field.value).toBe(String(Math.min(10, race.entrants.length)));
    expect(field.min).toBe("1");
  });
});
