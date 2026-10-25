import { createThemeContract } from "@vanilla-extract/css";
import { themeContract } from "./theme.ts";

export const tokens = createThemeContract({
  color: themeContract,
  space: { xs: null, s: null, m: null, l: null, xl: null },
  font: { body: null, mono: null },
  radius: { s: null },
  // WCAG 2.5.5 AAA target size.
  target: { min: null },
  // Fade for inactive things, set per theme so faded text keeps 4.5:1 for large text.
  dim: { opacity: null },
  // Dark overlays that read the same on both themes.
  overlay: { scrim: null, shadow: null },
});
