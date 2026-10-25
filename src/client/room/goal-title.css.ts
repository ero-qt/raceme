import { style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const goal = style({
  flex: "1 1 auto",
  minInlineSize: 0,
  margin: 0,
  fontSize: "1.25rem",
  overflowWrap: "anywhere",
});

// Matches the editable goal's height, so the page doesn't move when editing ends at the start.
export const plainGoal = style([
  goal,
  { display: "flex", alignItems: "center", minBlockSize: `calc(${tokens.target.min})` },
]);

// Pulls the input left by its padding and border so the editable goal lines up with plain text.
const inset = `calc(${tokens.space.xs} + 2px)`;

export const input = style({
  inlineSize: `calc(100% + ${inset})`,
  marginInlineStart: `calc(-1 * ${inset})`,
  paddingInline: tokens.space.xs,
  minBlockSize: tokens.target.min,
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "2px solid transparent",
  borderRadius: tokens.radius.s,
  transition: "border-color 150ms ease, background-color 150ms ease",
  cursor: "text",
  selectors: {
    "&:hover, &:focus": {
      borderColor: tokens.color.borderStrong,
      background: tokens.color.bg1,
    },
  },
});

export const form = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space.s,
});
