import type { ImageRow } from "../../shared/results.ts";

export type TextStyle = "title" | "footer" | "top" | "row";

export interface ResultsLayout {
  /** Width inside the padding, which every line shares. */
  width: number;
  /** Left edge of every name, the same for the podium rows and the rest. */
  nameX: number;
}

// Draws the first 3 places big with medal colors, like a podium.
const podiumSize = 3;

/** Picks the first `shown` rows for the image and how many of them get the podium look. */
export function pickImageRows(
  all: ImageRow[],
  shown: number,
): { rows: ImageRow[]; podium: number } {
  const rows = all.slice(0, shown);
  const placed = rows.filter((row) => row.place !== "").length;
  return { rows, podium: Math.min(podiumSize, placed) };
}

// Gives the space after the place number and the space before the time.
const placeGap = 10;
const timeGap = 24;

/**
 * Works out the image's columns. The podium rows and the rows below are measured in their own
 * font, so a long name below the podium widens the image only when it doesn't fit under the
 * podium's columns. Times end at the right edge.
 */
export function layoutResults(
  rows: ImageRow[],
  top: number,
  title: string,
  footer: { left: string; right: string },
  measure: (text: string, style: TextStyle) => number,
): ResultsLayout {
  const podium = rows.slice(0, top);
  const rest = rows.slice(top);
  const widest = (part: ImageRow[], pick: (row: ImageRow) => string, style: TextStyle) =>
    Math.max(0, ...part.map((row) => measure(pick(row), style)));

  const placeWidth = Math.max(
    widest(podium, (row) => row.place, "top"),
    widest(rest, (row) => row.place, "row"),
  );
  const nameX = placeWidth + placeGap;
  const tableWidth = (part: ImageRow[], style: TextStyle) =>
    part.length === 0
      ? 0
      : nameX +
        widest(part, (row) => row.name, style) +
        timeGap +
        widest(part, (row) => row.time, style);

  const width = Math.max(
    tableWidth(podium, "top"),
    tableWidth(rest, "row"),
    measure(title, "title"),
    measure(footer.left, "footer") + timeGap + measure(footer.right, "footer"),
  );
  return { width, nameX };
}
