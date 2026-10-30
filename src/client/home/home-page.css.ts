import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { outlined, panel } from "../styles/controls.css.ts";
import { container } from "../styles/layout.css.ts";
import { tokens } from "../styles/tokens.css.ts";

// The start form takes the wide left column and the intro the right one, stacked on phones.
export const page = style([
  container,
  {
    display: "grid",
    // Top-aligned, so an empty part of a column never covers a note opened from the footer, and
    // the stacked rows on a phone don't stretch over the page's spare height.
    alignItems: "start",
    alignContent: "start",
    // Stacked on a phone, the rows sit as far apart as the cards in the side column.
    rowGap: tokens.space.l,
    columnGap: tokens.space.xl,
    paddingBlock: tokens.space.l,
    "@media": { "(min-width: 48rem)": { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" } },
  },
]);

export const start = style({
  display: "flex",
  flexDirection: "column",
});

// The notice line stays in the page for screen readers and brings its own spacing once it has
// text, so an empty one puts nothing between the field and the first card.
globalStyle(`${start} > p:not(:empty)`, { paddingBlockStart: tokens.space.s });

export const side = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.l,
});

// The cards space their lines with the gap, so every card ends the same distance below its text.
export const card = style([
  panel,
  {
    display: "flex",
    flexDirection: "column",
    gap: tokens.space.m,
    padding: tokens.space.l,
    color: tokens.color.text1,
    background: tokens.color.bg1,
  },
]);

globalStyle(`${card} > p, ${card} > h2`, { margin: 0 });

export const cardHeading = style({
  fontSize: "1rem",
  color: tokens.color.text0,
});

export const introNote = style({
  color: tokens.color.text0,
});

export const field = style([
  outlined,
  {
    fontSize: "1rem",
    // Sits on the column's edge like the cards, with none of the room goal's pull to the left.
    marginInlineStart: 0,
    inlineSize: "100%",
    selectors: {
      // Hides a pasted room code on screen the way a password field would.
      '&[data-kind="code"]': { WebkitTextSecurity: "disc" } as Record<string, string>,
    },
  },
]);

const spin = keyframes({ to: { transform: "rotate(360deg)" } });

export const spinner = style({
  inlineSize: "1em",
  blockSize: "1em",
  animation: `${spin} 800ms linear infinite`,
});

// Keeps the status card as tall as its 2 count lines while it waits or gets no answer.
export const statusLines = style({ minBlockSize: "2lh" });

export const warning = style({
  display: "flex",
  alignItems: "flex-start",
  gap: tokens.space.s,
});
