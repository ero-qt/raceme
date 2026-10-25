import { style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const page = style({
  maxInlineSize: "60rem",
  marginInline: "auto",
  padding: tokens.space.l,
});

export const section = style({
  borderBlockStart: `1px solid ${tokens.color.border}`,
  paddingBlock: tokens.space.l,
});

export const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: tokens.space.s,
});
