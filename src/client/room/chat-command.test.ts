import { describe, expect, test } from "bun:test";
import { type RaceAction, type RaceState, apply, createRace } from "../../shared/race/race.ts";
import { chatCommand } from "./chat-command.ts";

function raceAfter(actions: RaceAction[]): RaceState {
  return actions.reduce(
    (state, action) => {
      const result = apply(state, action, 0);
      if (!result.ok) {
        throw new Error(result.refusal);
      }
      return result.state;
    },
    createRace({ countdownMs: 10_000 }),
  );
}

// Applies each action at its own server time, for races that need GO and the 5 s finish guard.
function playAt(state: RaceState, steps: [RaceAction, number][]): RaceState {
  return steps.reduce((current, [action, now]) => {
    const result = apply(current, action, now);
    if (!result.ok) {
      throw new Error(result.refusal);
    }
    return result.state;
  }, state);
}

const joined = raceAfter([
  { type: "setGoal", goal: "any%" },
  { type: "join", entrantId: "a", name: "alice" },
]);

describe("chatCommand", () => {
  test("reads SRL commands typed in the chat box as race actions", () => {
    expect(chatCommand(".ready", joined, "a")).toEqual({ type: "ready" });
    expect(chatCommand(" .DONE ", joined, "a")).toEqual({ type: "done" });
    expect(chatCommand(".quit", joined, "a")).toEqual({ type: "forfeit" });
    expect(chatCommand(".unenter", joined, "a")).toEqual({ type: "leave" });
    expect(chatCommand(".setgoal 120 star", joined, "a")).toEqual({
      type: "setGoal",
      goal: "120 star",
    });
  });

  test(".undone takes back a .quit when that's what the entrant did", () => {
    const bothReady = raceAfter([
      { type: "setGoal", goal: "any%" },
      { type: "join", entrantId: "a", name: "alice" },
      { type: "join", entrantId: "b", name: "bob" },
      { type: "ready", entrantId: "a" },
      { type: "ready", entrantId: "b" },
    ]);
    const quit = playAt(bothReady, [
      [{ type: "tick" }, 10_000],
      [{ type: "forfeit", entrantId: "a" }, 20_000],
    ]);
    expect(chatCommand(".undone", quit, "a")).toEqual({ type: "unforfeit" });
    expect(chatCommand(".undone", joined, "a")).toEqual({ type: "undone" });
  });

  test("leaves everything else as chat", () => {
    expect(chatCommand("gl hf", joined, "a")).toBeNull();
    expect(chatCommand(".readyy", joined, "a")).toBeNull();
    expect(chatCommand("type .done when finished", joined, "a")).toBeNull();
    expect(chatCommand(".setgoal", joined, "a")).toBeNull();
  });
});
