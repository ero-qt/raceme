import { createThemeContract } from "@vanilla-extract/css";
import { themeContract } from "./theme.ts";

export const tokens = createThemeContract({
  color: themeContract,
  space: { xs: null, s: null, m: null, l: null, xl: null },
  font: { body: null, mono: null },
  radius: { s: null },
  // Above the 24px WCAG 2.5.8 AA target size, so buttons stay easy to hit while compact.
  target: { min: null },
  // Fade for inactive things, measured so faded text keeps 4.5:1 on the palette.
  dim: { opacity: null },
  // Dark overlays for scrims and shadows.
  overlay: { scrim: null, shadow: null },
});
