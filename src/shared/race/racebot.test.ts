import { describe, expect, test } from "bun:test";
import { type RaceAction, type RaceState, apply, createRace } from "./race.ts";
import { announce, countdownCalls, ordinal } from "./racebot.ts";

// Every expected line below is copied from archived SpeedRunsLive race channel logs.

function step(state: RaceState, action: RaceAction, now = 0) {
  const result = apply(state, action, now);
  if (!result.ok) {
    throw new Error(result.refusal);
  }
  return { lines: announce(state, action, result.state), state: result.state };
}

function steps(
  actions: RaceAction[],
  now = 0,
  countdownMs = 10_000,
): { lines: string[]; state: RaceState } {
  let state = createRace({ countdownMs, fractionDigits: 0 });
  let lines: string[] = [];
  for (const action of actions) {
    ({ lines, state } = step(state, action, now));
  }
  return { lines, state };
}

const twoEntered: RaceAction[] = [
  { type: "setGoal", goal: "any%" },
  { type: "join", entrantId: "a", name: "Namaztak" },
  { type: "join", entrantId: "b", name: "Veract" },
];

const bothReady: RaceAction[] = [
  ...twoEntered,
  { type: "ready", entrantId: "a" },
  { type: "ready", entrantId: "b" },
];

describe("announce", () => {
  test("enter counts entrants, singular for 1", () => {
    expect(steps(twoEntered.slice(0, 2)).lines).toEqual(["Namaztak enters the race! 1 entrant."]);
    expect(steps(twoEntered).lines).toEqual(["Veract enters the race! 2 entrants."]);
  });

  test("goal", () => {
    expect(steps(twoEntered.slice(0, 1)).lines).toEqual(["Goal Set: any%"]);
  });

  test("the same goal again is no line", () => {
    const again = [...twoEntered.slice(0, 1), { type: "setGoal", goal: "any%" } as const];
    expect(steps(again).lines).toEqual([]);
  });

  test("ready counts who is left", () => {
    expect(steps([...twoEntered, { type: "ready", entrantId: "a" }]).lines).toEqual([
      "Namaztak is ready! 1 remaining.",
    ]);
  });

  test("the last ready starts the countdown", () => {
    expect(steps(bothReady).lines).toEqual([
      "Veract is ready! 0 remaining.",
      "The race will begin in 10 seconds!",
    ]);
  });

  test("says 1 second, not 1 seconds, for a 1 second countdown", () => {
    expect(steps(bothReady, 0, 1_000).lines).toContain("The race will begin in 1 second!");
  });

  test("unready and unenter", () => {
    const ready = [...twoEntered, { type: "ready", entrantId: "a" } as const];

    expect(steps([...ready, { type: "unready", entrantId: "a" }]).lines).toEqual([
      "Namaztak isn't ready!",
    ]);
    expect(steps([...twoEntered, { type: "leave", entrantId: "b" }]).lines).toEqual([
      "Veract has been removed from the race.",
    ]);
  });

  test("GO, finish, forfeit, undone", () => {
    let { state } = steps(bothReady);
    let lines: string[];

    ({ lines, state } = step(state, { type: "tick" }, 10_000));
    expect(lines).toEqual(["GO!"]);

    ({ lines, state } = step(state, { type: "done", entrantId: "a" }, 10_000 + 4_188_000));
    expect(lines).toEqual(["Namaztak has finished in 1st place with a time of 01:09:48."]);

    ({ lines, state } = step(state, { type: "forfeit", entrantId: "b" }, 10_000 + 4_200_000));
    expect(lines).toEqual(["Veract has forfeited from the race."]);

    ({ lines } = step(state, { type: "undone", entrantId: "a" }, 10_000 + 4_300_000));
    expect(lines).toEqual(["Namaztak has been undone from the race."]);
  });

  test("end, rematch and remove", () => {
    expect(steps([...twoEntered, { type: "end" }]).lines).toEqual([
      "Race terminated. The channel will be cleared in 10 minutes!",
    ]);
    expect(steps([...twoEntered, { type: "end" }, { type: "rematch" }]).lines).toEqual([
      "Rematch!",
    ]);
    expect(steps([...twoEntered, { type: "remove", targetId: "b" }]).lines).toEqual([
      "Veract has been removed from the race.",
    ]);
  });

  test("finish times use the room's fraction digits", () => {
    let { state } = steps([{ type: "setFractionDigits", digits: 2 }, ...bothReady]);
    ({ state } = step(state, { type: "tick" }, 10_000));

    const { lines } = step(state, { type: "done", entrantId: "a" }, 10_000 + 65_439);
    expect(lines).toEqual(["Namaztak has finished in 1st place with a time of 00:01:05.43."]);
  });

  test("a countdown started by a removal is announced too", () => {
    const { lines } = steps([
      ...twoEntered,
      { type: "ready", entrantId: "a" },
      { type: "remove", targetId: "b" },
    ]);

    expect(lines).toEqual([
      "Veract has been removed from the race.",
      "The race will begin in 10 seconds!",
    ]);
  });

  test("a tick that changes nothing says nothing", () => {
    expect(steps([...twoEntered, { type: "tick" }]).lines).toEqual([]);
  });
});

describe("countdownCalls", () => {
  test("calls 5 to 1 in the last 5 seconds", () => {
    expect(countdownCalls(10_000)).toEqual([
      { at: 5_000, text: "5" },
      { at: 6_000, text: "4" },
      { at: 7_000, text: "3" },
      { at: 8_000, text: "2" },
      { at: 9_000, text: "1" },
    ]);
  });
});

describe("ordinal", () => {
  test("handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "101st",
      "111th",
    ]);
  });
});
