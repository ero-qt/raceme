import { describe, expect, test } from "bun:test";
import { type RaceAction, type RaceState, apply, createRace } from "../../shared/race/race.ts";
import { availableActions } from "./available-actions.ts";

function run(state: RaceState, actions: RaceAction[], now = 0): RaceState {
  return actions.reduce((current, action) => {
    const result = apply(current, action, now);
    if (!result.ok) {
      throw new Error(result.refusal);
    }
    return result.state;
  }, state);
}

const open = run(createRace({ countdownMs: 1_000, fractionDigits: 0 }), [
  { type: "setGoal", goal: "any%" },
  { type: "join", entrantId: "a", name: "alice" },
  { type: "join", entrantId: "b", name: "bob" },
]);
const running = run(
  run(open, [
    { type: "ready", entrantId: "a" },
    { type: "ready", entrantId: "b" },
  ]),
  [{ type: "tick" }],
  1_000,
);

describe("availableActions", () => {
  test("a visitor can only join an open race", () => {
    expect(availableActions(open, "x", false)).toEqual(["join"]);
    expect(availableActions(running, "x", false)).toEqual([]);
  });

  test("an unready entrant can ready or leave", () => {
    expect(availableActions(open, "a", false)).toEqual(["ready", "leave"]);
  });

  test("a ready entrant can unready or leave", () => {
    const state = run(open, [{ type: "ready", entrantId: "a" }]);
    expect(availableActions(state, "a", false)).toEqual(["unready", "leave"]);
  });

  test("a racer can finish or forfeit", () => {
    expect(availableActions(running, "a", false)).toEqual(["done", "forfeit"]);
  });

  test("entrants and the host can rematch once the race is over, watchers can't", () => {
    const ended = run(running, [{ type: "end" }], 2_000);

    expect(availableActions(ended, "a", false)).toEqual(["rematch"]);
    expect(availableActions(ended, "x", true)).toEqual(["rematch"]);
    expect(availableActions(ended, "x", false)).toEqual([]);
  });

  test("a finisher can take it back", () => {
    const done = run(running, [{ type: "done", entrantId: "a" }], 10_000);
    expect(availableActions(done, "a", false)).toEqual(["undone"]);
    const finished = run(done, [{ type: "forfeit", entrantId: "b" }], 10_000);
    expect(availableActions(finished, "a", false)).toEqual(["undone", "rematch"]);
    const forfeit = run(running, [{ type: "forfeit", entrantId: "a" }], 10_000);
    expect(availableActions(forfeit, "a", false)).toEqual(["unforfeit"]);
  });
});
