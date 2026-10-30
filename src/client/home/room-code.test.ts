import { describe, expect, test } from "bun:test";
import { parseRoomCode } from "./room-code.ts";

describe("parseRoomCode", () => {
  test("accepts a bare code, ignoring case and spaces", () => {
    expect(parseRoomCode(" DuXanagxds ")).toBe("duxanagxds");
  });

  test("accepts a pasted invite link", () => {
    expect(parseRoomCode("https://ero-qt.eu/apps/raceme/duxanagxds")).toBe("duxanagxds");
  });

  test("accepts a link copied with a trailing slash, a query or punctuation after it", () => {
    for (const text of [
      "https://ero-qt.eu/apps/raceme/duxanagxds/",
      "https://ero-qt.eu/apps/raceme/duxanagxds?from=chat",
      "ero-qt.eu/apps/raceme/duxanagxds#top",
      "duxanagxds.",
    ]) {
      expect(parseRoomCode(text)).toBe("duxanagxds");
    }
  });

  test("rejects anything else", () => {
    expect(parseRoomCode("duxanagxd")).toBeNull();
    expect(parseRoomCode("duxanagxd1")).toBeNull();
    expect(parseRoomCode("")).toBeNull();
    expect(parseRoomCode("https://ero-qt.eu/apps/raceme/missing")).toBeNull();
  });

  test("takes the code from the last part of a link's path", () => {
    expect(parseRoomCode("https://example.com/tournament/duxanagxds")).toBe("duxanagxds");
    expect(parseRoomCode("https://example.com/speedraces/duxanagxds/")).toBe("duxanagxds");
  });
});
