import { style } from "@vanilla-extract/css";
import { disclosureSummary, panel } from "../styles/controls.css.ts";
import { container } from "../styles/layout.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const bar = style({
  marginBlockStart: "auto",
  background: tokens.color.bg1,
  borderBlockStart: `1px solid ${tokens.color.border}`,
});

// Positioned, so the notes open above it and never grow past its width.
export const inner = style([
  container,
  {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.space.s,
    paddingBlock: tokens.space.s,
  },
]);

export const summary = disclosureSummary;

// Opens above the summaries, anchored to the footer, so no summary moves when a note opens.
export const text = style([
  panel,
  {
    position: "absolute",
    insetBlockEnd: `calc(100% + ${tokens.space.s})`,
    insetInlineStart: tokens.space.l,
    inlineSize: `min(60ch, calc(100% - 2 * ${tokens.space.l}))`,
    // Fits the note between the top of the screen and the summaries below it.
    maxBlockSize: `calc(100dvh - ${tokens.target.min} - 3 * ${tokens.space.s})`,
    overflowY: "auto",
    paddingInline: tokens.space.m,
    color: tokens.color.text0,
    background: tokens.color.bg0,
  },
]);

// Breaks the 71-character digest and long commands anywhere, so the note never scrolls sideways.
export const digest = style({ overflowWrap: "anywhere" });
