import { describe, expect, test } from "bun:test";
import { formatClock } from "./format-time.ts";

describe("formatClock", () => {
  // SRL's RaceBot printed times like "01:09:48".
  test("shows HH:MM:SS, dropping partial seconds", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(65_999)).toBe("00:01:05");
    expect(formatClock(3_723_000)).toBe("01:02:03");
    expect(formatClock(100 * 3_600_000)).toBe("100:00:00");
  });

  test("adds tenths, hundredths or thousandths, cutting off the rest", () => {
    expect(formatClock(65_439, 1)).toBe("00:01:05.4");
    expect(formatClock(65_439, 2)).toBe("00:01:05.43");
    expect(formatClock(65_439, 3)).toBe("00:01:05.439");
    expect(formatClock(65_000, 2)).toBe("00:01:05.00");
  });

  test("rounds negative fractions away from zero too", () => {
    expect(formatClock(-9_001, 1)).toBe("-00:00:09.1");
    expect(formatClock(-1, 3)).toBe("-00:00:00.001");
  });

  test("rounds negative times away from zero", () => {
    expect(formatClock(-9_001)).toBe("-00:00:10");
    expect(formatClock(-1)).toBe("-00:00:01");
  });
});
