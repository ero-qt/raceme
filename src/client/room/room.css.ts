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
  tableLayout: "fixed",
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
  // A cell's height works as a minimum, so rows without a button match rows with one.
  blockSize: `calc(${tokens.target.min} + 2 * ${tokens.space.s})`,
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

export const rule = style({
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
  alignItems: "center",
  gap: tokens.space.s,
  minBlockSize: tokens.target.min,
});

export const entrantCount = style({
  display: "inline-flex",
  alignItems: "center",
  color: tokens.color.text1,
  fontVariantNumeric: "tabular-nums",
});

// Fits 2 digits plus the browser's up and down arrows.
const capWidth = "calc(2ch + 28px)";

// Looks like plain text until hovered or focused, like the race clock's digits.
export const capField = style({
  boxSizing: "border-box",
  inlineSize: capWidth,
  padding: 0,
  paddingInline: "2px",
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "2px solid transparent",
  borderRadius: tokens.radius.s,
  selectors: {
    "&:hover, &:focus-visible": {
      borderColor: tokens.color.borderStrong,
      background: tokens.color.bg1,
      outline: "none",
    },
  },
});

// Reserves 2 digits each, so going from 9 to 10 entrants or a cap of 8 to 50 moves nothing.
export const countDigits = style({
  display: "inline-block",
  minInlineSize: "2ch",
  textAlign: "end",
});
// Matches the cap field's box, so the count keeps its place after the start.
export const capDigits = style({
  display: "inline-block",
  boxSizing: "border-box",
  inlineSize: capWidth,
  paddingInline: "2px",
  border: "2px solid transparent",
});

export const headerSpacer = style({ flex: "1 1 auto" });

// Fits the longest room status, "Entry Closed", so a shorter one doesn't move the lock.
export const headerStatus = style({ minInlineSize: "13ch", textAlign: "end" });

export const headerButton = style({
  display: "inline-grid",
  placeItems: "center",
  inlineSize: tokens.target.min,
  blockSize: tokens.target.min,
  padding: 0,
  color: tokens.color.text1,
  background: "transparent",
  border: "none",
  borderRadius: tokens.radius.s,
  selectors: {
    "button&": { cursor: "pointer" },
    "button&:hover:not(:disabled)": { background: tokens.color.bgHover, color: tokens.color.text0 },
    "button&:disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
});

export const headerIcon = style({
  inlineSize: "1.25em",
  blockSize: "1.25em",
});

export const entrantsTitle = style({
  margin: 0,
  fontSize: "1rem",
});

export const placeColumn = style({ inlineSize: "3.5ch" });
export const muteColumn = style({ inlineSize: tokens.target.min });
export const statusColumn = style({ inlineSize: "12ch" });
export const timeColumn = style({ inlineSize: "13ch" });
export const actionColumn = style({ inlineSize: "10rem" });

export const placeCell = style([cell, { textAlign: "end" }]);
export const muteCell = style([cell, { paddingInline: 0, textAlign: "center" }]);

export const actionCell = style([cell, { textAlign: "end" }]);

export const download = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  color: tokens.color.link,
});

export const muteButton = style({
  inlineSize: tokens.target.min,
  paddingInline: 0,
  borderColor: "transparent",
  selectors: { "&[data-muted=true]": { color: tokens.color.statusForfeit } },
});

export const rowIcon = style({
  inlineSize: "1.25em",
  blockSize: "1.25em",
});

export const empty = style({
  margin: 0,
  color: tokens.color.text1,
});
