import { keyframes, style } from "@vanilla-extract/css";
import { outlined, panel } from "../styles/controls.css.ts";
import { container } from "../styles/layout.css.ts";
import { tokens } from "../styles/tokens.css.ts";

// The start form takes the wide left column and the intro the right one, stacked on phones.
export const page = style([
  container,
  {
    display: "grid",
    // Top-aligned, so an empty part of a column never covers a note opened from the footer.
    alignItems: "start",
    gap: tokens.space.xl,
    paddingBlock: tokens.space.l,
    "@media": { "(min-width: 48rem)": { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" } },
  },
]);

export const start = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.s,
});

export const intro = style([
  panel,
  {
    padding: tokens.space.l,
    color: tokens.color.text1,
    background: tokens.color.bg1,
  },
]);

export const introHeading = style({
  margin: 0,
  fontSize: "1rem",
  color: tokens.color.text0,
});

export const introNote = style({
  margin: 0,
  color: tokens.color.text0,
});

export const field = style([
  outlined,
  {
    fontSize: "1rem",
    selectors: {
      // Hides a pasted room code on screen the way a password field would.
      '&[data-kind="code"]': { WebkitTextSecurity: "disc" } as Record<string, string>,
    },
  },
]);

export const visuallyHidden = style({
  position: "absolute",
  inlineSize: "1px",
  blockSize: "1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
});

const spin = keyframes({ to: { transform: "rotate(360deg)" } });

export const spinner = style({
  inlineSize: "1em",
  blockSize: "1em",
  animation: `${spin} 800ms linear infinite`,
});

export const warning = style({
  display: "flex",
  alignItems: "flex-start",
  gap: tokens.space.s,
});
