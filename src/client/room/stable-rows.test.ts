import { describe, expect, test } from "bun:test";
import type { Standing } from "../../shared/race/race.ts";
import { stableRows } from "./stable-rows.ts";

const alice: Standing = { id: "a", name: "alice", ready: false, result: null, place: null };
const bob: Standing = { id: "b", name: "bob", ready: false, result: null, place: null };

describe("stableRows", () => {
  test("keeps the old object for a row that reads the same", () => {
    const rows = stableRows([alice, bob], [{ ...alice }, { ...bob, ready: true }]);
    expect(rows[0]).toBe(alice);
    expect(rows[1]).not.toBe(bob);
    expect(rows[1]?.ready).toBe(true);
  });

  test("keeps the whole list when nothing changed", () => {
    const previous = [alice, bob];
    expect(stableRows(previous, [{ ...alice }, { ...bob }])).toBe(previous);
  });

  test("tells a new time apart from the old one", () => {
    const done: Standing = { ...alice, result: { kind: "done", timeMs: 5 }, place: 1 };
    const faster = { ...done, result: { kind: "done" as const, timeMs: 4 } };
    expect(stableRows([done], [faster])[0]).toBe(faster);
    expect(stableRows([done], [{ ...done }])[0]).toBe(done);
  });
});
