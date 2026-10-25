import { style } from "@vanilla-extract/css";
import { divider } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const page = style({
  maxInlineSize: "60rem",
  marginInline: "auto",
  padding: tokens.space.l,
});

export const section = style([divider, { paddingBlock: tokens.space.l }]);

export const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: tokens.space.s,
});
