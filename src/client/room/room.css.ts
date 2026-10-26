import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import {
  controlBorder,
  disclosureSummary,
  divider,
  inlineEdit,
  panel,
  warningPanel,
} from "../styles/controls.css.ts";
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

export const cell = style([
  divider,
  {
    padding: tokens.space.s,
    // A cell's height works as a minimum, so rows without a button match rows with one.
    blockSize: `calc(${tokens.target.min} + 2 * ${tokens.space.s})`,
  },
]);

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

export const closedBox = style([
  warningPanel,
  {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.space.s,
    margin: 0,
    color: tokens.color.text0,
    paddingBlock: tokens.space.s,
    paddingInline: tokens.space.m,
  },
]);

export const closedReason = style({
  margin: 0,
  color: tokens.color.danger,
  fontWeight: 700,
});

export const rule = style([
  divider,
  { marginBlock: tokens.space.s, marginInline: 0, borderInline: "none", borderBlockEnd: "none" },
]);

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

// Wraps the status and the lock onto a second line only below 390 pixels, since phones get
// smaller gaps.
export const entrantsHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: tokens.space.s,
  minBlockSize: tokens.target.min,
  "@media": { "(max-width: 40rem)": { gap: tokens.space.xs } },
});

export const entrantCount = style({
  display: "inline-flex",
  alignItems: "center",
  color: tokens.color.text1,
  fontVariantNumeric: "tabular-nums",
});

// Fits 2 digits plus the browser's up and down arrows.
const capWidth = "calc(2ch + 28px)";

export const capField = style([
  inlineEdit,
  { boxSizing: "border-box", inlineSize: capWidth, padding: 0, paddingInline: "2px" },
]);

// Reserves 2 digits each, so going from 9 to 10 entrants or a cap of 8 to 50 moves nothing.
export const countDigits = style({
  display: "inline-block",
  minInlineSize: "2ch",
  textAlign: "end",
});
// Matches the cap field's box, so the count keeps its place after the start.
export const capDigits = style([
  controlBorder,
  { display: "inline-block", boxSizing: "border-box", inlineSize: capWidth, paddingInline: "2px" },
]);

export const watcherCount = style([entrantCount, { gap: tokens.space.xs }]);

export const headerSpacer = style({ flex: "1 1 auto" });

// Fits the longest room status, "Entry Closed", so a shorter one doesn't move the lock. Phones
// give that space to the title's line instead.
export const headerStatus = style({
  minInlineSize: "13ch",
  textAlign: "end",
  "@media": { "(max-width: 40rem)": { minInlineSize: 0 } },
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
export const muteColumn = style({
  inlineSize: `calc(${tokens.target.min} + 2 * ${tokens.space.s})`,
});
export const statusColumn = style({ inlineSize: "12ch" });
export const timeColumn = style({ inlineSize: "13ch" });
// Fits the widest row button, `.unenter`, in the monospace button font: 8 characters plus the
// button's padding and border and the cell's padding.
export const actionColumn = style({
  inlineSize: `calc(8ch + 2 * ${tokens.space.l} + 4px + 2 * ${tokens.space.s})`,
});

export const placeCell = style([cell, { textAlign: "end" }]);
export const muteCell = style([cell, { paddingInline: tokens.space.s, textAlign: "center" }]);

export const actionCell = style([cell, { textAlign: "end" }]);

export const stackedActions = style({ marginBlockStart: tokens.space.xs });

// Stretches every row button to the column, so .unenter, .quit and .remove line up.
globalStyle(`${actionCell} button`, { inlineSize: "100%" });
globalStyle(`${stackedActions} button`, { inlineSize: "auto" });

export const download = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  color: tokens.color.link,
});

export const muteButton = style({
  selectors: { "&[data-muted=true]": { color: tokens.color.statusForfeit } },
});

const hiddenTimer = { "&[data-hidden=true]": { visibility: "hidden" } } as const;

export const roomTimerDot = style({
  paddingInline: tokens.space.xs,
  fontSize: "0.6em",
  selectors: hiddenTimer,
});

export const roomTimerTime = style({ selectors: hiddenTimer });

export const roomTimer = style({
  inlineSize: "auto",
  paddingInline: tokens.space.s,
  gap: tokens.space.xs,
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums",
});

export const exportSection = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
  alignItems: "start",
  gap: tokens.space.s,
});

export const exportSetting = style({ display: "flex", alignItems: "center" });

export const exportImage = style([
  panel,
  { display: "block", maxInlineSize: "100%", marginBlockStart: tokens.space.xs },
]);

// Takes the columns of the parts a format doesn't offer, so every row fills the grid.
export const exportDetails = style({
  minInlineSize: 0,
  selectors: {
    '&[data-span="2"]': { gridColumn: "span 2" },
    '&[data-span="3"]': { gridColumn: "span 3" },
    '&[data-span="4"]': { gridColumn: "span 4" },
  },
});

export const exportSummary = style([disclosureSummary, { minInlineSize: "6ch" }]);

export const exportText = style([
  panel,
  {
    display: "block",
    inlineSize: "100%",
    marginBlockStart: tokens.space.xs,
    padding: tokens.space.s,
    resize: "vertical",
    font: "inherit",
    fontFamily: tokens.font.mono,
    fontSize: "0.8125rem",
    color: tokens.color.text0,
    background: tokens.color.bg1,
  },
]);

export const rowIcon = style({
  inlineSize: "1.25em",
  blockSize: "1.25em",
});

export const empty = style({
  margin: 0,
  color: tokens.color.text1,
});
