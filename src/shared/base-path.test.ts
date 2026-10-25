import { describe, expect, test } from "bun:test";
import { normalizeBasePath } from "./base-path.ts";

describe("normalizeBasePath", () => {
  test("keeps root as empty prefix", () => {
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("")).toBe("");
  });

  test("adds leading slash, drops trailing slash", () => {
    expect(normalizeBasePath("apps/raceme/")).toBe("/apps/raceme");
    expect(normalizeBasePath("/apps/raceme")).toBe("/apps/raceme");
  });

  test("rejects anything but plain path segments", () => {
    expect(() => normalizeBasePath("/apps/../etc")).toThrow();
    expect(() => normalizeBasePath("https://evil.example")).toThrow();
  });
});
