import type { RaceState } from "../../shared/race/race.ts";
import { resultsImageRows } from "../../shared/results.ts";
import { type TextStyle, layoutResults, pickImageRows } from "./results-image-layout.ts";

const scale = 2;
const padding = 28;
// Leaves the footer closer to the bottom edge than the title is to the top.
const bottomPadding = 16;
const sectionGap = 20;
const ruleGap = 12;
const fonts: Record<TextStyle, string> = {
  title: "bold 22px monospace",
  footer: "14px monospace",
  top: "bold 26px monospace",
  row: "15px monospace",
};
const lineHeights: Record<TextStyle, number> = { title: 32, footer: 24, top: 38, row: 28 };
// Medal colors for the first 3 places, used for the place number itself.
const medals = ["#d4af37", "#b4b7bd", "#cd7f32"];

/**
 * Draws the race results as a PNG in the page's own colors. The goal comes first, then the first
 * `shown` rows with the podium big in medal colors and a line before those without a place. The
 * footer gives the entrant count, the race's date and time in the viewer's time zone and raceme.
 */
export async function resultsImage(race: RaceState, shown: number): Promise<Blob> {
  const all = resultsImageRows(race);
  const { rows, podium: highlighted } = pickImageRows(all, shown);
  const page = getComputedStyle(document.body);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser can't draw images.");
  }

  const started = new Date(race.startsAt ?? race.endedAt ?? Date.now());
  const time = started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const entrants = `${all.length} ${all.length === 1 ? "entrant" : "entrants"}`;
  const footer = { left: `${entrants} · ${started.toLocaleDateString()} ${time}`, right: "raceme" };
  const title = race.goal ?? "race";
  const measure = (text: string, style: TextStyle) => {
    context.font = fonts[style];
    return context.measureText(text).width;
  };
  const { width, nameX } = layoutResults(rows, highlighted, title, footer, measure);

  const unplaced = rows.findIndex((row) => row.place === "");
  const dividerGap = unplaced > 0 ? ruleGap : 0;
  const tableHeight =
    lineHeights.top * highlighted + lineHeights.row * (rows.length - highlighted) + dividerGap;
  canvas.width = (width + 2 * padding) * scale;
  canvas.height =
    (padding +
      bottomPadding +
      lineHeights.title +
      tableHeight +
      lineHeights.footer +
      2 * sectionGap) *
    scale;
  context.scale(scale, scale);
  context.fillStyle = page.backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "middle";

  let y = padding;
  const text = (value: string, x: number, style: TextStyle, options: TextOptions = {}) => {
    context.font = fonts[style];
    context.textAlign = options.align ?? "start";
    context.globalAlpha = options.alpha ?? 1;
    context.fillStyle = options.color ?? page.color;
    context.fillText(value, padding + x, y + lineHeights[style] / 2);
    context.globalAlpha = 1;
  };

  text(title, 0, "title", { color: themeColor("a") });
  y += lineHeights.title + sectionGap;

  for (const [i, row] of rows.entries()) {
    if (i === unplaced && i > 0) {
      context.globalAlpha = 0.3;
      context.fillStyle = page.color;
      context.fillRect(padding, y + ruleGap / 2, width, 1);
      context.globalAlpha = 1;
      y += ruleGap;
    }
    const style = i < highlighted ? "top" : "row";
    const medal = style === "top" ? medals[Number(row.place) - 1] : undefined;
    text(row.place, 0, style, medal ? { color: medal } : {});
    text(row.name, nameX, style);
    text(row.time, width, style, { align: "end", alpha: style === "top" ? 1 : 0.85 });
    y += lineHeights[style];
  }

  y += sectionGap;
  text(footer.left, 0, "footer", { alpha: 0.7 });
  text(footer.right, width, "footer", { align: "end", alpha: 0.7 });

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Drawing failed."))),
      "image/png",
    ),
  );
}

interface TextOptions {
  align?: CanvasTextAlign;
  alpha?: number;
  color?: string;
}

/** Reads the color the page gives an element, like a link's orange in the current theme. */
function themeColor(tag: string): string {
  const probe = document.body.appendChild(document.createElement(tag));
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
