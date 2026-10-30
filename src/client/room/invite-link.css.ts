import { style } from "@vanilla-extract/css";
import { outlined } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const frame = style([
  outlined,
  {
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    minBlockSize: tokens.target.min,
    background: tokens.color.bg1,
    color: tokens.color.text0,
    selectors: {
      '&[data-visibility="warned"]': {
        color: tokens.color.statusForfeit,
        borderColor: tokens.color.statusForfeit,
      },
    },
  },
]);

const bare = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space.s,
  padding: tokens.space.s,
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "none",
  cursor: "pointer",
});

export const copy = style([
  bare,
  {
    flex: "none",
    justifyContent: "center",
    minInlineSize: tokens.target.min,
    borderRadius: tokens.radius.s,
    transition: "background-color 150ms ease",
    selectors: {
      "&:hover": { background: tokens.color.bgHover },
    },
  },
]);

export const revealArea = style({
  position: "relative",
  display: "flex",
  flex: "1 1 auto",
  minInlineSize: 0,
  marginInlineStart: tokens.space.s,
});

export const reveal = style([
  bare,
  {
    flex: "1 1 auto",
    minInlineSize: 0,
    paddingInlineStart: 0,
    textAlign: "start",
  },
]);

export const decoy = style({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  pointerEvents: "none",
  overflow: "hidden",
  whiteSpace: "nowrap",
  color: tokens.color.text1,
  filter: "blur(4px)",
  userSelect: "none",
  // Fades the blurred ends out so the blur neither bleeds into the link icon nor stops hard.
  maskImage:
    "linear-gradient(to right, transparent, black 1rem, black calc(100% - 1rem), transparent)",
});

export const text = style({
  minInlineSize: 0,
  overflowWrap: "anywhere",
});

// Floats just above the copy button so "copied" shows where the click happened.
export const toast = style({
  position: "absolute",
  insetBlockEnd: "100%",
  insetInlineStart: 0,
  margin: 0,
  marginBlockEnd: tokens.space.xs,
  selectors: {
    "&:not(:empty)": {
      padding: `0 ${tokens.space.s}`,
      background: tokens.color.bg2,
      color: tokens.color.text0,
      border: `1px solid ${tokens.color.borderStrong}`,
      borderRadius: tokens.radius.s,
    },
  },
});
