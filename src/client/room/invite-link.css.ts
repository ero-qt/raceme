import { style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const frame = style({
  position: "relative",
  display: "flex",
  alignItems: "stretch",
  minBlockSize: tokens.target.min,
  background: tokens.color.bg1,
  color: tokens.color.text0,
  border: `2px solid ${tokens.color.borderStrong}`,
  borderRadius: tokens.radius.s,
  selectors: {
    '&[data-visibility="warned"]': {
      color: tokens.color.statusForfeit,
      borderColor: tokens.color.statusForfeit,
    },
  },
});

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

export const reveal = style([
  bare,
  {
    flex: "1 1 auto",
    minInlineSize: 0,
    marginInlineStart: tokens.space.s,
    paddingInlineStart: 0,
    textAlign: "start",
  },
]);

export const icon = style({ flex: "none", inlineSize: "1.25em", blockSize: "1.25em" });

const bar = tokens.color.text1;
const bars = `${bar} 0 5ch, transparent 5ch 6ch, ${bar} 6ch 9ch, transparent 9ch 10ch`;

// Draws blurred bars that look like a hidden link, so the real link never sits in the page.
export const decoy = style({
  flex: "1 1 auto",
  blockSize: "0.6em",
  backgroundImage: `repeating-linear-gradient(90deg, ${bars})`,
  borderRadius: tokens.radius.s,
  filter: "blur(4px)",
  opacity: 0.6,
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

export const visuallyHidden = style({
  position: "absolute",
  inlineSize: "1px",
  blockSize: "1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
});
