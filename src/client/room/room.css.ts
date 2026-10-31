import { globalStyle, style } from "@vanilla-extract/css";
import {
  controlBorder,
  disclosureSummary,
  divider,
  icon,
  inlineEdit,
  panel,
  warningPanel,
} from "../styles/controls.css.ts";
import { container } from "../styles/layout.css.ts";
import { tokens } from "../styles/tokens.css.ts";

const phone = "(max-width: 47.99rem)";

// The room details take the wide left column and the chat the right one. Phones show one of
// the 2 at a time, with the tab bar under it.
export const page = style([
  container,
  {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "start",
    gap: tokens.space.l,
    paddingBlock: tokens.space.l,
    "@media": {
      "(min-width: 48rem)": {
        // The chat keeps room for its clock line and the name field with `.enter` beside it.
        gridTemplateColumns: "minmax(0, 2fr) minmax(22rem, 1fr)",
        selectors: { '&[data-closed="true"]': { gridTemplateColumns: "minmax(0, 1fr)" } },
      },
      // The shown card gets the spare height, the tab bar keeps its own.
      [phone]: { gridTemplateRows: "1fr auto" },
    },
  },
]);

const card = style([
  panel,
  {
    display: "flex",
    flexDirection: "column",
    gap: tokens.space.s,
    padding: tokens.space.l,
    background: tokens.color.bg1,
    "@media": { [phone]: { selectors: { '&[data-active="false"]': { display: "none" } } } },
  },
]);

export const raceCard = card;

// Stretches to the row, so the chat log gets the height the room details or the window gives it.
export const chatCard = style([card, { alignSelf: "stretch" }]);

export const clockBlock = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
});

// Fits the longest room status, "entry closed", so a shorter one keeps the same box.
export const clockStatus = style({ display: "inline-block", minInlineSize: "13ch" });

// A bar under the shown card on a phone. It sticks to the screen's bottom while the page is
// longer than the screen, and the footer scrolls in below it.
export const tabBar = style({
  display: "none",
  "@media": {
    [phone]: {
      position: "sticky",
      insetBlockEnd: 0,
      // Eats the page's padding, so the bar reaches the screen's edges and the footer.
      marginInline: `calc(-1 * ${tokens.space.l})`,
      marginBlockEnd: `calc(-1 * ${tokens.space.l})`,
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      gap: tokens.space.s,
      paddingInline: tokens.space.l,
      paddingBlock: tokens.space.s,
      background: tokens.color.bg1,
      borderBlockStart: `1px solid ${tokens.color.border}`,
    },
  },
});

export const tabButton = style([
  controlBorder,
  {
    minBlockSize: tokens.target.min,
    paddingInline: tokens.space.s,
    font: "inherit",
    fontWeight: 700,
    color: tokens.color.text1,
    background: "transparent",
    cursor: "pointer",
    selectors: {
      '&[aria-pressed="true"]': { color: tokens.color.text0, borderColor: tokens.color.accent },
    },
  },
]);

export const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: tokens.space.s,
});

export const joinForm = style([row, { rowGap: tokens.space.xs }]);

// Always one line tall, in the log's small text, so the form doesn't move when entry closes,
// the race fills up or the host mutes you.
export const formNotice = style({ flexBasis: "100%", minBlockSize: "1lh", fontSize: "0.75rem" });

// The name column takes the room the others leave. Each other column asks for the width of its
// widest content, so nothing moves as statuses, times and buttons change. A column still grows
// past that for longer content.
export const table = style({
  inlineSize: "100%",
  tableLayout: "auto",
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

export const chatRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: tokens.space.s,
  rowGap: tokens.space.xs,
});

// The box, `send` and the race buttons share one line under the notice line. The box gives way
// so the buttons always fit.
export const chatLine = style({
  display: "flex",
  alignItems: "flex-end",
  gap: tokens.space.s,
  flex: "1 1 0",
  minInlineSize: 0,
});

// A square, so the enter arrow sits centered and the button takes as little of the line as it can.
export const sendButton = style({ inlineSize: tokens.target.min, paddingInline: 0 });

// Lets the message box take the rest of its line next to `send`.
globalStyle(`${chatLine} > div`, { flex: "1 1 0", minInlineSize: 0 });

export const clockLine = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: tokens.space.s,
});

// `.end` and `.rematch` at the top right of the clock line.
export const clockActions = style({
  display: "flex",
  gap: tokens.space.s,
  marginInlineStart: "auto",
});

export const entrants = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.s,
});

// Wraps the lock onto a second line only below 390 pixels, since phones get smaller gaps.
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

// Fits 3 digits plus the browser's up and down arrows.
const capWidth = "calc(3ch + 28px)";

export const capField = style([
  inlineEdit,
  { boxSizing: "border-box", inlineSize: capWidth, padding: 0, paddingInline: "2px" },
]);

// Reserves 3 digits each, so going from 99 to 100 entrants or a cap of 8 to 300 moves nothing.
export const countDigits = style({
  display: "inline-block",
  minInlineSize: "3ch",
  textAlign: "end",
});
// Sits right after the eye, with the same 3 digits reserved so a growing count moves nothing.
export const watcherDigits = style([countDigits, { textAlign: "start" }]);
// Lifts the eye to the middle of the digits, which sit above the middle of their line box.
export const watcherIcon = style([icon, { position: "relative", insetBlockStart: "-0.07em" }]);
// Matches the cap field's box, so the count keeps its place after the start.
export const capDigits = style([
  controlBorder,
  { display: "inline-block", boxSizing: "border-box", inlineSize: capWidth, paddingInline: "2px" },
]);

export const watcherCount = style([entrantCount, { gap: tokens.space.xs }]);

export const headerSpacer = style({ flex: "1 1 auto" });

export const entrantsTitle = style({
  margin: 0,
  fontSize: "1rem",
});

// One character of the body's monospace font (0.6em of the 0.9375rem body size). The head cells
// have a smaller font, so their own `ch` would undersize the columns.
const bodyCh = "0.5625rem";

// Each column's minimum is its widest content, so nothing moves as cells change. The name column
// takes the rest. The mute column sizes to its button on its own.
// Fits 3 digits with the narrow padding of the place cell, so the name column keeps its room on phones.
export const placeColumn = style({ boxSizing: "border-box", minInlineSize: `calc(4 * ${bodyCh})` });
export const nameColumn = style({ inlineSize: "100%" });
// Fits a finished time with every digit, `00:00:00.000`, plus the cell's padding. On phones the
// status column shows that time in place of the Done badge, so it needs the same room.
const timeWidth = `calc(12 * ${bodyCh} + 2 * ${tokens.space.s})`;
export const statusColumn = style({ boxSizing: "border-box", minInlineSize: timeWidth });
export const timeColumn = style({ boxSizing: "border-box", minInlineSize: timeWidth });
// Fits the widest row button, `.unenter`: 8 characters plus the button's padding and border and
// the cell's padding.
export const actionColumn = style({
  boxSizing: "border-box",
  minInlineSize: `calc(8 * ${bodyCh} + 4 * ${tokens.space.s} + 4px)`,
});
// The table shows its time and button columns from this width on: the mute, place, status, time
// and button minimums above at the body's 15px font (48 + 36 + 124 + 124 + 108) and 100px of name.
export const wideTableMinPx = 540;

export const placeCell = style([cell, { textAlign: "end", paddingInline: tokens.space.xs }]);
// A long name with no space in it wraps inside the cell instead of widening the table.
export const nameCell = style([cell, { overflowWrap: "anywhere" }]);
export const muteCell = style([cell, { paddingInline: tokens.space.s, textAlign: "center" }]);

export const actionCell = style([cell, { textAlign: "end" }]);

export const stackedActions = style({ marginBlockStart: tokens.space.xs });

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
