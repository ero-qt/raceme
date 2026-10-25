import { style } from "@vanilla-extract/css";
import { panel } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

export const log = style([
  panel,
  {
    blockSize: "16rem",
    overflowY: "auto",
    padding: tokens.space.s,
    background: tokens.color.bg1,
    fontFamily: tokens.font.mono,
    fontSize: "0.875rem",
  },
]);

export const line = style({
  margin: 0,
  overflowWrap: "anywhere",
});

export const time = style({ color: tokens.color.text1 });

export const bot = style({ color: tokens.color.statusCountdown, fontWeight: 700 });

export const nick = style({ color: tokens.color.statusRunning, fontWeight: 700 });
