import { style } from "@vanilla-extract/css";
import { tokens } from "./tokens.css.ts";

/** Centers a page's content at the site's width, with the same side padding on every page. */
export const container = style({
  inlineSize: "100%",
  maxInlineSize: "72rem",
  marginInline: "auto",
  paddingInline: tokens.space.l,
});
