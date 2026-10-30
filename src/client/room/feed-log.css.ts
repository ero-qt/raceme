import { style } from "@vanilla-extract/css";
import { panel } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const log = style([
  panel,
  {
    flex: "1 1 16rem",
    minBlockSize: "16rem",
    overflowY: "auto",
    padding: tokens.space.s,
    background: tokens.color.bg1,
    fontFamily: tokens.font.mono,
    fontSize: "0.75rem",
  },
]);

export const line = style({
  margin: 0,
  overflowWrap: "anywhere",
});

// Sized against the log's own text, so the whole log scales together.
export const time = style({
  color: tokens.color.text1,
  fontSize: "0.85em",
});

export const bot = style({ color: tokens.color.statusCountdown });

export const notice = style({ color: tokens.color.statusForfeit });

export const nick = style({
  color: tokens.color.statusRunning,
  fontSize: "0.93em",
  fontWeight: 700,
});
