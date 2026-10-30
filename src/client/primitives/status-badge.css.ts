import { style, styleVariants } from "@vanilla-extract/css";
import { tokens } from "../styles/tokens.css.ts";

const base = style({
  display: "inline-block",
  fontWeight: 700,
  fontSize: "0.8125rem",
});

export const statusColor = styleVariants({
  open: [base, { color: tokens.color.statusOpen }],
  countdown: [base, { color: tokens.color.statusCountdown }],
  running: [base, { color: tokens.color.statusRunning }],
  done: [base, { color: tokens.color.statusDone }],
  forfeit: [base, { color: tokens.color.statusForfeit }],
});
