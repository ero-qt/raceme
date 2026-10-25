import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const page = style({
  maxInlineSize: "52rem",
  marginInline: "auto",
  padding: tokens.space.l,
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.s,
});

export const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: tokens.space.s,
});

export const table = style({
  inlineSize: "100%",
  borderCollapse: "collapse",
  background: tokens.color.bg1,
});

export const headCell = style({
  textAlign: "start",
  background: tokens.color.bg2,
  color: tokens.color.text1,
  padding: tokens.space.s,
  fontSize: "0.8125rem",
});

export const cell = style({
  padding: tokens.space.s,
  borderBlockStart: `1px solid ${tokens.color.border}`,
});

export const timeCell = style([
  cell,
  { fontFamily: tokens.font.mono, fontVariantNumeric: "tabular-nums" },
]);

export const notice = style({
  margin: 0,
  color: tokens.color.statusForfeit,
});

export const visuallyHidden = style({
  position: "absolute",
  inlineSize: "1px",
  blockSize: "1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
});

export const chat = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.s,
});

export const chatRow = style({
  display: "flex",
  alignItems: "flex-end",
  gap: tokens.space.s,
});

// Lets the message box shrink so `send` and the main buttons stay on its line on a phone.
globalStyle(`${chatRow} > div`, { flex: "1 1 0", minInlineSize: 0 });

export const clockLine = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: tokens.space.s,
});

export const entrants = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.s,
});

export const entrantsHeader = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: tokens.space.s,
});

export const entrantsTitle = style({
  margin: 0,
  fontSize: "1rem",
});

export const actionCell = style([cell, { textAlign: "end" }]);

export const download = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  color: tokens.color.link,
});

export const empty = style({
  margin: 0,
  color: tokens.color.text1,
});
