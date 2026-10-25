import { style } from "@vanilla-extract/css";
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
