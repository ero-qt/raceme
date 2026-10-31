import { style } from "@vanilla-extract/css";
import { inlineEdit } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const goal = style({
  flex: "1 1 auto",
  minInlineSize: 0,
  margin: 0,
  fontSize: "1.25rem",
  // Keeps the editable goal's box at the control height, so it matches the plain heading.
  lineHeight: 1.2,
  overflowWrap: "anywhere",
});

// Matches the editable goal's height, so the page doesn't move when editing ends at the start.
// `flex: none` keeps the heading from growing into the page's spare height.
export const plainGoal = style([
  goal,
  { display: "flex", flex: "none", alignItems: "center", minBlockSize: tokens.target.min },
]);

export const input = style([
  inlineEdit,
  {
    inlineSize: "100%",
    paddingInlineEnd: tokens.space.xs,
    minBlockSize: tokens.target.min,
    cursor: "text",
    selectors: {
      // Keeps the underline while typing after a mouse click too, which `:focus-visible` skips.
      "&:focus": { borderBlockEndColor: tokens.color.borderStrong },
    },
  },
]);

export const form = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space.s,
});
