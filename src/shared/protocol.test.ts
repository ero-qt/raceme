import { describe, expect, test } from "bun:test";
import { maxMessageLength, parseClientAction } from "./protocol.ts";

describe("parseClientAction", () => {
  test("accepts every plain action", () => {
    for (const type of [
      "leave",
      "ready",
      "unready",
      "done",
      "undone",
      "forfeit",
      "unforfeit",
      "active",
    ]) {
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

  // JSON escapes quotes and backslashes. Emoji count as 2 UTF-16 units each.
  test("accepts a full chat line of characters JSON escapes or emoji", () => {
    for (const text of ['"'.repeat(512), "\\".repeat(512), "🏁".repeat(256)]) {
      expect(parseClientAction(JSON.stringify({ type: "say", text }))).toEqual({
        type: "say",
        text,
      });
    }
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
    const oversized = JSON.stringify({ type: "join", name: "x".repeat(maxMessageLength) });
    expect(parseClientAction(oversized)).toBeNull();
  });
});
