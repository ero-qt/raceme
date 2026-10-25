import { describe, expect, test } from "bun:test";
import { parseClientAction } from "./protocol.ts";

describe("parseClientAction", () => {
  test("accepts every plain action", () => {
    for (const type of ["leave", "ready", "unready", "done", "undone", "forfeit", "unforfeit"]) {
      expect(parseClientAction(JSON.stringify({ type }))).toEqual({ type } as never);
    }
  });

  test("accepts join with a name and setGoal with a goal", () => {
    expect(parseClientAction('{"type":"join","name":"alice"}')).toEqual({
      type: "join",
      name: "alice",
    });
    expect(parseClientAction('{"type":"setGoal","goal":"any%"}')).toEqual({
      type: "setGoal",
      goal: "any%",
    });
  });

  test("accepts say with text", () => {
    expect(parseClientAction('{"type":"say","text":"gl hf"}')).toEqual({
      type: "say",
      text: "gl hf",
    });
  });

  test("accepts end and rematch, and remove with a target", () => {
    expect(parseClientAction('{"type":"end"}')).toEqual({ type: "end" });
    expect(parseClientAction('{"type":"rematch"}')).toEqual({ type: "rematch" });
    expect(parseClientAction('{"type":"remove","entrantId":"abcd2345"}')).toEqual({
      type: "remove",
      entrantId: "abcd2345",
    });

    expect(parseClientAction('{"type":"remove"}')).toBeNull();
  });

  test("accepts setFractionDigits with 0 to 3 only", () => {
    expect(parseClientAction('{"type":"setFractionDigits","digits":2}')).toEqual({
      type: "setFractionDigits",
      digits: 2,
    });

    expect(parseClientAction('{"type":"setFractionDigits","digits":4}')).toBeNull();
    expect(parseClientAction('{"type":"setFractionDigits","digits":"2"}')).toBeNull();
  });

  test("drops fields it does not know, like a forged entrantId", () => {
    expect(parseClientAction('{"type":"done","entrantId":"someone-else"}')).toEqual({
      type: "done",
    });
  });

  test("rejects unknown types, missing strings, bad JSON and oversized input", () => {
    expect(parseClientAction('{"type":"tick"}')).toBeNull();
    expect(parseClientAction('{"type":"join"}')).toBeNull();
    expect(parseClientAction('{"type":"join","name":5}')).toBeNull();
    expect(parseClientAction("not json")).toBeNull();
    expect(parseClientAction("[]")).toBeNull();
    expect(parseClientAction(JSON.stringify({ type: "join", name: "x".repeat(2000) }))).toBeNull();
  });
});

describe("parseClientAction fuzzing", () => {
  // Small seeded generator so a failure always reproduces with the same inputs.
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  }

  const pieces = [
    '{"type":',
    '"join"',
    '"say"',
    '"remove"',
    '"setFractionDigits"',
    '"digits":',
    '"name":',
    '"text":',
    '"entrantId":',
    "null",
    "true",
    "1e999",
    "-0",
    "[]",
    "{}",
    '"\\u0000"',
    ",",
    "}",
    "]",
    ":",
    '"__proto__"',
    '"constructor"',
    "9",
    '"x"',
  ];

  function randomInput(next: () => number): string {
    const length = Math.floor(next() * 12);
    let raw = "";
    for (let j = 0; j < length; j++) {
      raw += pieces[Math.floor(next() * pieces.length)];
    }
    return raw;
  }

  test("never throws and only returns known action shapes", () => {
    const next = random(42);
    const known = new Set([
      "join",
      "setGoal",
      "say",
      "remove",
      "setFractionDigits",
      "leave",
      "ready",
      "unready",
      "done",
      "undone",
      "forfeit",
      "unforfeit",
      "end",
      "rematch",
    ]);

    for (let i = 0; i < 20_000; i++) {
      const action = parseClientAction(randomInput(next));
      if (action !== null) {
        expect(known.has(action.type)).toBe(true);
      }
    }
  });
});
