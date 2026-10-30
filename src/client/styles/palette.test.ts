import { describe, expect, test } from "bun:test";
import { contrastRatio } from "./contrast.ts";
import { palette as theme } from "./palette.ts";

// WCAG 2.2 AA: 4.5:1 for text (1.4.3), 3:1 for UI component boundaries and focus (1.4.11).
const textMinimum = 4.5;
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

describe("palette", () => {
  for (const surface of surfaces) {
    for (const text of texts) {
      test(`${text} on ${surface} reaches 4.5:1`, () => {
        expect(contrastRatio(theme[text], theme[surface])).toBeGreaterThanOrEqual(textMinimum);
      });
    }
    for (const line of lines) {
      test(`${line} on ${surface} reaches 3:1`, () => {
        expect(contrastRatio(theme[line], theme[surface])).toBeGreaterThanOrEqual(nonTextMinimum);
      });
    }
  }

  test("link text reaches 4.5:1 on bg0 and bg1", () => {
    expect(contrastRatio(theme.link, theme.bg0)).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(theme.link, theme.bg1)).toBeGreaterThanOrEqual(textMinimum);
  });

  test("accentFg on accent reaches 4.5:1", () => {
    expect(contrastRatio(theme.accentFg, theme.accent)).toBeGreaterThanOrEqual(textMinimum);
  });

  test("placeholder reaches 4.5:1 on inputs yet stays apart from typed text", () => {
    expect(contrastRatio(theme.placeholder, theme.bg1)).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(theme.placeholder, theme.text0)).toBeGreaterThanOrEqual(1.5);
  });

  test("goFg on go reaches 4.5:1", () => {
    expect(contrastRatio(theme.goFg, theme.go)).toBeGreaterThanOrEqual(textMinimum);
  });

  // The closing warning and the closed-room note print their headline in this red on panels.
  test("danger as text reaches 4.5:1 on the page, the cards and the panels", () => {
    for (const surface of ["bg0", "bg1", "bg2"] as const) {
      expect([surface, contrastRatio(theme.danger, theme[surface]) >= textMinimum]).toEqual([
        surface,
        true,
      ]);
    }
  });

  test("dangerFg on danger reaches 4.5:1", () => {
    expect(contrastRatio(theme.dangerFg, theme.danger)).toBeGreaterThanOrEqual(textMinimum);
  });
});
