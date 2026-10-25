import { describe, expect, test } from "bun:test";
import { Feed } from "./feed.ts";

describe("Feed", () => {
  test("numbers entries and keeps only the newest", () => {
    const feed = new Feed(3);
    feed.add([{ kind: "bot", text: "a", at: 1 }]);
    const added = feed.add([
      { kind: "bot", text: "b", at: 2 },
      { kind: "chat", name: "alice", text: "hi", at: 3 },
      { kind: "bot", text: "c", at: 4 },
    ]);
    expect(added.map((e) => e.id)).toEqual([2, 3, 4]);
    expect(feed.entries.map((e) => e.text)).toEqual(["b", "hi", "c"]);
  });
});
