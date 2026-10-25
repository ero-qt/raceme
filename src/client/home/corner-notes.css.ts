import { style } from "@vanilla-extract/css";
import { disclosureSummary, panel } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

// Sits in the bottom left corner, clear of the suggestions that open under the start form.
export const corner = style({
  position: "fixed",
  insetBlockEnd: tokens.space.s,
  insetInlineStart: tokens.space.s,
  display: "flex",
  gap: tokens.space.s,
});

export const summary = disclosureSummary;

// Opens above the summaries, anchored to the corner, so no summary moves when a note opens.
export const text = style([
  panel,
  {
    position: "absolute",
    insetBlockEnd: `calc(100% + ${tokens.space.s})`,
    insetInlineStart: 0,
    inlineSize: `min(60ch, calc(100vw - 2 * ${tokens.space.s}))`,
    // Fits the note between the top of the screen and the summaries below it.
    maxBlockSize: `calc(100dvh - ${tokens.target.min} - 3 * ${tokens.space.s})`,
    overflowY: "auto",
    paddingInline: tokens.space.m,
    color: tokens.color.text0,
    background: tokens.color.bg0,
  },
]);
