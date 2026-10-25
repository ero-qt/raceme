import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

const columnWidth = "52rem";

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: tokens.space.s,
  maxInlineSize: columnWidth,
  marginInline: "auto",
  paddingInline: tokens.space.l,
  paddingBlockStart: tokens.space.s,
  "@media": {
    // Spreads the header to the window edges, level with the page's first line, once there is
    // room beside the column. Its zero height keeps the box itself off the goal field, so only
    // the link and the button cover anything, out at the edges.
    "(min-width: 72rem)": {
      position: "absolute",
      insetBlockStart: tokens.space.l,
      insetInline: 0,
      maxInlineSize: "none",
      blockSize: 0,
      alignItems: "flex-start",
      paddingBlockStart: 0,
    },
  },
});

export const home = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  fontWeight: 700,
  color: tokens.color.text0,
  textDecoration: "none",
  selectors: {
    "&:hover": { textDecoration: "underline" },
  },
});

// Keeps the 44px touch target while the visible icon stays small and frameless.
export const theme = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  inlineSize: tokens.target.min,
  blockSize: tokens.target.min,
  padding: 0,
  color: tokens.color.text1,
  background: "transparent",
  border: "none",
  borderRadius: tokens.radius.s,
  cursor: "pointer",
  selectors: {
    "&:hover": { color: tokens.color.text0, background: tokens.color.bgHover },
  },
});

export const themeIcon = style({ inlineSize: "1.125rem", blockSize: "1.125rem" });

export const status = style({
  display: "flex",
  alignItems: "center",
  marginInlineEnd: "auto",
  color: tokens.color.text1,
});

// Lets the wrapper Solid's portal adds join the row, so its children line up with the name.
globalStyle(`${status} > div`, { display: "contents" });
