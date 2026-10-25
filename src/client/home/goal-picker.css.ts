import { style } from "@vanilla-extract/css";
import { dimWhenDisabled, outlined } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const category = style([
  outlined,
  dimWhenDisabled,
  {
    flex: "none",
    maxInlineSize: "40%",
    minBlockSize: tokens.target.min,
    paddingInline: tokens.space.xs,
    font: "inherit",
    color: "inherit",
    background: tokens.color.bg1,
  },
]);
