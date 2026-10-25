import { afterEach, describe, expect, test } from "bun:test";
import { loadFractionDigits, saveFractionDigits } from "./fraction-preference.ts";

afterEach(() => localStorage.clear());

describe("fraction preference", () => {
  test("is empty until the viewer picks, so the room default applies", () => {
    expect(loadFractionDigits()).toBeNull();
  });

  test("keeps the viewer's pick", () => {
    saveFractionDigits(3);
    expect(loadFractionDigits()).toBe(3);
  });

  test("ignores junk", () => {
    localStorage.setItem("raceme.fractionDigits", "7");
    expect(loadFractionDigits()).toBeNull();
  });
});
