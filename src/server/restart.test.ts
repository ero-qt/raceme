import { describe, expect, test } from "bun:test";
import { nextRestartAt } from "./restart.ts";

describe("nextRestartAt", () => {
  test("picks today's restart hour in UTC, or tomorrow's once it has passed", () => {
    expect(nextRestartAt(Date.UTC(2026, 9, 25, 7, 30), 10)).toBe(Date.UTC(2026, 9, 25, 10));
    expect(nextRestartAt(Date.UTC(2026, 9, 25, 10), 10)).toBe(Date.UTC(2026, 9, 26, 10));
    expect(nextRestartAt(Date.UTC(2026, 9, 25, 19, 38), 10)).toBe(Date.UTC(2026, 9, 26, 10));
  });
});
