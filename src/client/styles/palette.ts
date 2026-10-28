import type { Theme } from "./theme.ts";

/** The one set of colors raceme uses: a mid-gray page with near-white text, 7:1 everywhere. */
export const palette: Theme = {
  bg0: "#26282c",
  bg1: "#2e3136",
  bg2: "#373b41",
  bgHover: "#3f444b",
  border: "#4a4f57",
  borderStrong: "#8a93a3",
  text0: "#f4f5f7",
  text1: "#d7dadf",
  placeholder: "#bcc2ca",
  link: "#ffb144",
  accent: "#ff9500",
  accentFg: "#1a1205",
  focus: "#ffd27a",
  go: "#7ee08a",
  goFg: "#06200b",
  danger: "#ff7466",
  dangerFg: "#2a0503",
  statusOpen: "#a6eaae",
  statusCountdown: "#ffd678",
  statusRunning: "#badfff",
  statusDone: "#dfd4ff",
  statusForfeit: "#ffd1cd",
};
