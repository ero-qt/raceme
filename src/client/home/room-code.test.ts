import { describe, expect, test } from "bun:test";
import { parseRoomCode } from "./room-code.ts";

describe("parseRoomCode", () => {
  test("accepts a bare code, ignoring case and spaces", () => {
    expect(parseRoomCode(" DuXanagxds ")).toBe("duxanagxds");
  });

  test("accepts a pasted invite link", () => {
    expect(parseRoomCode("https://ero-qt.eu/apps/raceme/r/duxanagxds")).toBe("duxanagxds");
  });

  test("rejects anything else", () => {
    expect(parseRoomCode("duxanagxd")).toBeNull();
    expect(parseRoomCode("duxanagxd1")).toBeNull();
    expect(parseRoomCode("")).toBeNull();
  });
});
