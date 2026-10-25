import { style } from "@vanilla-extract/css";
import { warningPanel } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const placement = style({
  position: "fixed",
  inset: 0,
  zIndex: 2,
  display: "grid",
  justifyItems: "center",
  alignItems: "start",
  paddingBlockStart: tokens.space.l,
  background: tokens.overlay.scrim,
  pointerEvents: "none",
});

export const card = style([
  warningPanel,
  {
    display: "grid",
    gap: tokens.space.s,
    inlineSize: "max-content",
    maxInlineSize: `calc(100vw - 2 * ${tokens.space.l})`,
    paddingBlock: tokens.space.m,
    paddingInline: tokens.space.m,
    boxShadow: tokens.overlay.shadow,
  },
]);

// Keeps every digit the same width, so the heading doesn't shift as the countdown ticks.
export const countdown = style({ fontVariantNumeric: "tabular-nums" });

export const title = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  margin: 0,
  color: tokens.color.danger,
  fontSize: "0.9375rem",
});

export const heading = style({
  display: "inline-flex",
  alignItems: "center",
  gap: tokens.space.xs,
});

export const icon = style({
  inlineSize: "1.1em",
  blockSize: "1.1em",
});

export const text = style({
  margin: 0,
  color: tokens.color.text0,
  fontSize: "0.8125rem",
  lineHeight: 1.4,
});
