import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const field = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.xs,
  flex: "1 1 12rem",
});

export const label = style({
  fontWeight: 700,
  color: tokens.color.text1,
  fontSize: "0.8125rem",
  selectors: {
    // Stays in the page for screen readers while a placeholder stands in for it on screen.
    '&[data-hidden="true"]': {
      position: "absolute",
      inlineSize: "1px",
      blockSize: "1px",
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    },
  },
});

export const input = style({
  minBlockSize: tokens.target.min,
  paddingInline: tokens.space.m,
  background: tokens.color.bg1,
  color: tokens.color.text0,
  border: `2px solid ${tokens.color.borderStrong}`,
  borderRadius: tokens.radius.s,
  font: "inherit",
});

// WCAG leaves disabled controls out of contrast rules, so their placeholder can fade.
globalStyle(`${input}:disabled::placeholder`, { color: tokens.color.borderStrong });
