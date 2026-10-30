import type { Theme } from "./theme.ts";

/** The one set of colors raceme uses: a mid-gray page with near-white text, 4.5:1 everywhere. */
export const palette: Theme = {
  bg0: "#26282c",
  bg1: "#2e3136",
  bg2: "#373b41",
  bgHover: "#3f444b",
  border: "#4a4f57",
  borderStrong: "#8a93a3",
  text0: "#f4f5f7",
  text1: "#c3c8cf",
  placeholder: "#a9b0b9",
  link: "#ffa21f",
  accent: "#ff9500",
  accentFg: "#1a1205",
  focus: "#ffd27a",
  go: "#7ee08a",
  goFg: "#06200b",
  danger: "#ff857a",
  dangerFg: "#2a0503",
  statusOpen: "#7ee08a",
  statusCountdown: "#ffd166",
  statusRunning: "#8ecbff",
  statusDone: "#cdbcff",
  statusForfeit: "#ffa49d",
};
