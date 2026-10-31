import { globalStyle, style } from "@vanilla-extract/css";
import { dimmed, inlineEdit } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

// Marks keyboard focus on the whole clock instead of a ring around the select alone, through
// the `:has(:focus-visible)` part of `inlineEdit`.
export const clock = style([
  inlineEdit,
  {
    display: "inline-flex",
    alignItems: "baseline",
    paddingInlineEnd: tokens.space.xs,
    fontFamily: tokens.font.mono,
    fontSize: "2rem",
    // Keeps the underline close under the digits, which the body's 1.5 line height pushes away.
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    cursor: "pointer",
  },
]);

// Dims the digits before GO instead of a minus sign, so the clock keeps its width.
export const countdown = dimmed;

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

// Fades the fraction from the main text color like the digits, since fading its dimmer color
// as well would drop below 4.5:1.
globalStyle(`${countdown} ${fraction}`, { color: "inherit" });
