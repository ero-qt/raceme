import { describe, expect, test } from "bun:test";
import { contrastRatio } from "../contrast.ts";
import type { Theme } from "../theme.ts";
import { darkTheme } from "./dark.ts";
import { lightTheme } from "./light.ts";

// WCAG 2.2 AAA: 7:1 for text (1.4.6), 3:1 for UI component boundaries and focus (1.4.11).
const textMinimum = 7;
const nonTextMinimum = 3;

const surfaces = ["bg0", "bg1", "bg2", "bgHover"] as const;
const texts = [
  "text0",
  "text1",
  "statusOpen",
  "statusCountdown",
  "statusRunning",
  "statusDone",
  "statusForfeit",
] as const;
const lines = ["borderStrong", "focus"] as const;

describe.each([
  ["dark", darkTheme],
  ["light", lightTheme],
] as [string, Theme][])("%s theme", (_name, theme) => {
  for (const surface of surfaces) {
    for (const text of texts) {
      test(`${text} on ${surface} reaches 7:1`, () => {
        expect(contrastRatio(theme[text], theme[surface])).toBeGreaterThanOrEqual(textMinimum);
      });
    }
    for (const line of lines) {
      test(`${line} on ${surface} reaches 3:1`, () => {
        expect(contrastRatio(theme[line], theme[surface])).toBeGreaterThanOrEqual(nonTextMinimum);
      });
    }
  }

  test("link text reaches 7:1 on bg0 and bg1", () => {
    expect(contrastRatio(theme.link, theme.bg0)).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(theme.link, theme.bg1)).toBeGreaterThanOrEqual(textMinimum);
  });

  test("accentFg on accent reaches 7:1", () => {
    expect(contrastRatio(theme.accentFg, theme.accent)).toBeGreaterThanOrEqual(textMinimum);
  });

  test("placeholder reaches 7:1 on inputs yet stays apart from typed text", () => {
    expect(contrastRatio(theme.placeholder, theme.bg1)).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(theme.placeholder, theme.text0)).toBeGreaterThanOrEqual(1.5);
  });

  test("goFg on go reaches 7:1", () => {
    expect(contrastRatio(theme.goFg, theme.go)).toBeGreaterThanOrEqual(textMinimum);
  });

  test("dangerFg on danger reaches 7:1", () => {
    expect(contrastRatio(theme.dangerFg, theme.danger)).toBeGreaterThanOrEqual(textMinimum);
  });
});

// Button fills come with their own text color, so they can look the same in both themes.
test("button fills and their text are the same in dark and light", () => {
  for (const key of ["accent", "accentFg", "go", "goFg", "danger", "dangerFg"] as const) {
    expect(lightTheme[key]).toBe(darkTheme[key]);
  }
});
