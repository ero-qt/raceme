import { describe, expect, test } from "bun:test";
import { contrastRatio } from "./contrast.ts";

describe("contrastRatio", () => {
  test("black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  test("is symmetric", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#777777"),
      10,
    );
  });

  // #767676 on white is the well-known 4.54:1 gray from the WCAG examples.
  test("matches the WCAG reference gray", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  test("rejects anything but 6-digit hex", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});
