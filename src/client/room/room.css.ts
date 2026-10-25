import { globalStyle, keyframes, style } from "@vanilla-extract/css";
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

export const closedNotice = style({
  display: "grid",
  gap: tokens.space.s,
});

export const closedBox = style({
  display: "flex",
  alignItems: "flex-start",
  gap: tokens.space.s,
  margin: 0,
  color: tokens.color.text0,
  paddingBlock: tokens.space.s,
  paddingInline: tokens.space.m,
  background: tokens.color.bg2,
  border: `1px solid ${tokens.color.border}`,
  borderInlineStart: `3px solid ${tokens.color.danger}`,
  borderRadius: tokens.radius.s,
});

export const closedReason = style({
  margin: 0,
  color: tokens.color.danger,
  fontWeight: 700,
});

export const closedRule = style({
  margin: 0,
  border: "none",
  borderBlockStart: `1px solid ${tokens.color.border}`,
});

export const closedIcon = style({
  flex: "none",
  inlineSize: "1.1em",
  blockSize: "1.1em",
  color: tokens.color.danger,
  // Centers the icon on the first line of text, since the body line height is 1.5.
  marginBlockStart: "0.2em",
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

export const sendButton = style({ position: "relative" });

export const sendLabel = style({
  selectors: { "&[data-waiting=true]": { visibility: "hidden" } },
});

const drain = keyframes({ from: { strokeDashoffset: 0 }, to: { strokeDashoffset: 1 } });

export const waitRing = style({
  position: "absolute",
  inset: 0,
  margin: "auto",
  inlineSize: "1.25em",
  blockSize: "1.25em",
  transform: "rotate(-90deg)",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeDasharray: 1,
  animationName: drain,
  animationTimingFunction: "linear",
  animationFillMode: "forwards",
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
