import { keyframes, style } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

export const field = style({
  borderColor: tokens.color.borderStrong,
  selectors: {
    // Hides a pasted room code on screen the way a password field would.
    '&[data-kind="code"]': { WebkitTextSecurity: "disc" } as Record<string, string>,
  },
});

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
