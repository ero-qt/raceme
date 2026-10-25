import { describe, expect, test } from "bun:test";
import type { ImageRow } from "../../shared/results.ts";
import { layoutResults } from "./results-image-layout.ts";

// Monospace stand-in: every character is as wide as the font size.
const size = { title: 22, footer: 14, top: 26, row: 15 } as const;
const measure = (text: string, style: keyof typeof size) => text.length * size[style];
const footer = { left: "9 entrants", right: "raceme" };

function rows(names: string[]): ImageRow[] {
  return names.map((name, i) => ({ place: String(i + 1), name, time: "00:01:00" }));
}

const base = rows(["ero", "veract", "puwexil", "kirby", "zyrrus"]);
const layout = (list: ImageRow[]) => layoutResults(list, 3, "any%", footer, measure);

describe("layoutResults", () => {
  test("a longer name below the podium that still fits under it moves nothing", () => {
    const longer = rows(["ero", "veract", "puwexil", "kirby", "a much longer name"]);
    expect(layout(longer)).toEqual(layout(base));
  });

  test("a name below the podium too long to fit widens the image", () => {
    const tooLong = rows(["ero", "veract", "puwexil", "kirby", "a name of twenty four c"]);
    expect(layout(tooLong).width).toBeGreaterThan(layout(base).width);
  });

  test("a long podium name widens the image for every row", () => {
    const podiumLong = rows(["ero", "a long podium name", "puwexil", "kirby", "zyrrus"]);
    expect(layout(podiumLong).width).toBeGreaterThan(layout(base).width);
    expect(layout(podiumLong).nameX).toBe(layout(base).nameX);
  });
});
