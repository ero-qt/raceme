import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

// Pulls the control left by its padding and border so the digits line up with the page edge.
const inset = `calc(${tokens.space.xs} + 2px)`;

export const clock = style({
  display: "inline-flex",
  alignItems: "baseline",
  marginInlineStart: `calc(-1 * ${inset})`,
  paddingInline: tokens.space.xs,
  fontFamily: tokens.font.mono,
  fontSize: "2.5rem",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  border: "2px solid transparent",
  borderRadius: tokens.radius.s,
  cursor: "pointer",
  transition: "border-color 150ms ease, background-color 150ms ease",
  selectors: {
    // Marks keyboard focus on the whole clock instead of a ring around the select alone.
    "&:hover, &:has(:focus-visible)": {
      borderColor: tokens.color.borderStrong,
      background: tokens.color.bg1,
    },
  },
});

export const fraction = style({
  appearance: "none",
  minInlineSize: "4ch",
  padding: 0,
  font: "inherit",
  fontSize: "0.5em",
  color: tokens.color.text1,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  selectors: {
    "&:focus-visible": { outline: "none" },
  },
});

// Colors the native option list, which otherwise opens in the browser's light default.
globalStyle(`${fraction} option`, {
  background: tokens.color.bg2,
  color: tokens.color.text0,
});
