import { style } from "@vanilla-extract/css";
import { inlineEdit } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const goal = style({
  flex: "1 1 auto",
  minInlineSize: 0,
  margin: 0,
  fontSize: "1.25rem",
  overflowWrap: "anywhere",
});

// Matches the editable goal's height, so the page doesn't move when editing ends at the start.
// `flex: none` keeps the heading from growing into the page's spare height.
export const plainGoal = style([
  goal,
  { display: "flex", flex: "none", alignItems: "center", minBlockSize: tokens.target.min },
]);

// Pulls the input left by its padding and border so the editable goal lines up with plain text.
const inset = `calc(${tokens.space.xs} + 2px)`;

export const input = style([
  inlineEdit,
  {
    inlineSize: `calc(100% + ${inset})`,
    marginInlineStart: `calc(-1 * ${inset})`,
    paddingInline: tokens.space.xs,
    minBlockSize: tokens.target.min,
    cursor: "text",
    selectors: {
      // Keeps the border while typing after a mouse click too, which `:focus-visible` skips.
      "&:focus": { borderColor: tokens.color.borderStrong, background: tokens.color.bg1 },
    },
  },
]);

export const form = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space.s,
});
