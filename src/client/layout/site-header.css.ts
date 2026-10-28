import { globalStyle, style } from "@vanilla-extract/css";
import { container } from "../styles/layout.css.ts";
import { tokens } from "../styles/tokens.css.ts";

// A bar across the window, with the orange line under it as the site's mark.
export const bar = style({
  background: tokens.color.bg1,
  borderBlockEnd: `2px solid ${tokens.color.accent}`,
});

export const inner = style([
  container,
  {
    display: "flex",
    alignItems: "center",
    gap: tokens.space.m,
    minBlockSize: "3.5rem",
  },
]);

export const home = style({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: tokens.target.min,
  fontSize: "1.25rem",
  fontWeight: 700,
  color: tokens.color.text0,
  textDecoration: "none",
  selectors: {
    "&:hover": { textDecoration: "underline" },
  },
});

export const status = style({
  display: "flex",
  alignItems: "center",
  marginInlineEnd: "auto",
  color: tokens.color.text1,
});

// Lets the wrapper Solid's portal adds join the row, so its children line up with the name.
globalStyle(`${status} > div`, { display: "contents" });
