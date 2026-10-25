import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

// Sits in the bottom left corner, clear of the suggestions that open under the start form.
export const corner = style({
  position: "fixed",
  insetBlockEnd: tokens.space.s,
  insetInlineStart: tokens.space.s,
  display: "flex",
  alignItems: "flex-end",
  gap: tokens.space.s,
  maxInlineSize: `calc(100vw - 2 * ${tokens.space.s})`,
});

export const note = style({
  maxInlineSize: "60ch",
  color: tokens.color.text0,
  background: tokens.color.bg0,
});

export const summary = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  paddingInline: tokens.space.s,
  cursor: "pointer",
});

// Ends the last line where a closed summary's text sits, centered in a target-sized row.
export const text = style({
  maxBlockSize: "50vh",
  overflowY: "auto",
  paddingInline: tokens.space.s,
  paddingBlockEnd: `calc((${tokens.target.min} - 1lh) / 2)`,
});

globalStyle(`${text} > :last-child`, { marginBlockEnd: 0 });
