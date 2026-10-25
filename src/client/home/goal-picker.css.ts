import { style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const category = style({
  flex: "none",
  maxInlineSize: "40%",
  minBlockSize: tokens.target.min,
  paddingInline: tokens.space.xs,
  font: "inherit",
  color: "inherit",
  background: tokens.color.bg1,
  border: `2px solid ${tokens.color.borderStrong}`,
  borderRadius: tokens.radius.s,
});
