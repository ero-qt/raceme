import { style } from "@vanilla-extract/css";
import { panel } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const box = style({
  position: "relative",
  flex: "1 1 auto",
  minInlineSize: 0,
});

export const list = style([
  panel,
  {
    position: "absolute",
    insetInline: 0,
    insetBlockStart: `calc(100% + ${tokens.space.xs})`,
    zIndex: 1,
    margin: 0,
    padding: 0,
    overflow: "hidden",
    fontSize: "1rem",
    background: tokens.color.bg2,
  },
]);

const row = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: tokens.space.s,
  cursor: "pointer",
  selectors: {
    "&:hover": { background: tokens.color.bgHover },
    '&[data-active="true"]': {
      background: tokens.color.bgHover,
      outline: `2px solid ${tokens.color.focus}`,
      outlineOffset: "-2px",
    },
  },
});

const rowHeight = tokens.target.min;

export const header = style([
  row,
  {
    minBlockSize: rowHeight,
    paddingInline: tokens.space.s,
    color: tokens.color.text1,
  },
]);

// Lines option text up with the header label, which starts after the header's icon.
const iconGutter = `calc(${tokens.space.s} + 1em + ${tokens.space.xs})`;

export const option = style([
  row,
  {
    minBlockSize: rowHeight,
    paddingInlineStart: iconGutter,
    paddingInlineEnd: tokens.space.s,
    overflowWrap: "anywhere",
    selectors: {
      // The plus of the row for the field's own text sits in the icon column.
      '&[data-typed="true"]': { paddingInlineStart: tokens.space.s },
      // The × fills the end of a removable row.
      '&[data-removable="true"]': { paddingInlineEnd: 0 },
    },
  },
]);

export const label = style({
  display: "inline-flex",
  alignItems: "center",
  gap: tokens.space.xs,
});

export const typed = style([
  label,
  {
    fontStyle: "italic",
    color: tokens.color.text1,
  },
]);

export const remove = style({
  display: "grid",
  placeItems: "center",
  flex: "none",
  alignSelf: "stretch",
  inlineSize: rowHeight,
  color: tokens.color.danger,
  selectors: {
    "&:hover": { color: tokens.color.dangerFg, background: tokens.color.danger },
  },
});

export const icon = style({
  inlineSize: "1em",
  blockSize: "1em",
});
