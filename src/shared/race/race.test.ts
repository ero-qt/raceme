import { describe, expect, test } from "bun:test";
import { type RaceAction, type RaceState, apply, createRace, standings } from "./race.ts";

const countdownMs = 10_000;

function run(state: RaceState, action: RaceAction, now = 0): RaceState {
  const result = apply(state, action, now);
  if (!result.ok) {
    throw new Error(`Refused '${action.type}': ${result.refusal}`);
  }
  return result.state;
}

function refusal(state: RaceState, action: RaceAction, now = 0): string | undefined {
  const result = apply(state, action, now);
  return result.ok ? undefined : result.refusal;
}

function twoJoined(): RaceState {
  let state = createRace({ countdownMs });
  state = run(state, { type: "setGoal", goal: "any%" });
  state = run(state, { type: "join", entrantId: "a", name: "alice" });
  return run(state, { type: "join", entrantId: "b", name: "bob" });
}

function running(): RaceState {
  let state = twoJoined();
  state = run(state, { type: "ready", entrantId: "a" });
  state = run(state, { type: "ready", entrantId: "b" }, 1_000);
  return run(state, { type: "tick" }, 1_000 + countdownMs);
}

const startedAt = 1_000 + countdownMs;

describe("joining", () => {
  test("adds entrants unready, in join order", () => {
    const state = twoJoined();

    expect(state.entrants.map((e) => [e.name, e.ready])).toEqual([
      ["alice", false],
      ["bob", false],
    ]);
  });

  test("refuses a name already taken, ignoring case", () => {
    expect(refusal(twoJoined(), { type: "join", entrantId: "c", name: "ALICE" })).toBe("nameTaken");
  });

  test("refuses an empty or too long name", () => {
    expect(refusal(twoJoined(), { type: "join", entrantId: "c", name: "  " })).toBe("badName");
    expect(refusal(twoJoined(), { type: "join", entrantId: "c", name: "x".repeat(25) })).toBe(
      "badName",
    );
  });

  test("refuses the bot's name, so chat can't pass for its announcements", () => {
    expect(refusal(twoJoined(), { type: "join", entrantId: "c", name: "racebot" })).toBe(
      "nameTaken",
    );
  });

  test("refuses joining twice", () => {
    expect(refusal(twoJoined(), { type: "join", entrantId: "a", name: "alice2" })).toBe(
      "alreadyJoined",
    );
  });

  test("refuses joining a running race", () => {
    expect(refusal(running(), { type: "join", entrantId: "c", name: "carol" })).toBe("wrongPhase");
  });

  test("leave removes the entrant before the start", () => {
    const state = run(twoJoined(), { type: "leave", entrantId: "b" });

    expect(state.entrants.map((e) => e.name)).toEqual(["alice"]);
  });

  // SRL: once the race runs, quitting means forfeiting.
  test("refuses leaving a running race", () => {
    expect(refusal(running(), { type: "leave", entrantId: "a" })).toBe("wrongPhase");
  });
});

describe("readying", () => {
  // SRL: a goal must be set before players may ready up.
  test("refuses ready without a goal", () => {
    let state = createRace({ countdownMs });
    state = run(state, { type: "join", entrantId: "a", name: "alice" });

    expect(refusal(state, { type: "ready", entrantId: "a" })).toBe("noGoal");
  });

  test("starts the countdown once every entrant is ready", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    expect(state.phase).toBe("open");

    state = run(state, { type: "ready", entrantId: "b" }, 1_000);
    expect(state.phase).toBe("countdown");
    expect(state.startsAt).toBe(startedAt);
  });

  // Unlike SRL, a solo racer can start, for practice or for testing a room.
  test("a lone ready entrant starts the countdown", () => {
    let state = createRace({ countdownMs });
    state = run(state, { type: "setGoal", goal: "any%" });
    state = run(state, { type: "join", entrantId: "a", name: "alice" });
    state = run(state, { type: "ready", entrantId: "a" });

    expect(state.phase).toBe("countdown");
  });

  test("an empty room never counts down", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "leave", entrantId: "a" });
    state = run(state, { type: "leave", entrantId: "b" });

    expect(state.phase).toBe("open");
  });

  test("unready during the countdown stops it", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "ready", entrantId: "b" });
    state = run(state, { type: "unready", entrantId: "b" });

    expect(state.phase).toBe("open");
    expect(state.startsAt).toBeNull();
  });

  test("a new entrant during the countdown stops it", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "ready", entrantId: "b" });
    state = run(state, { type: "join", entrantId: "c", name: "carol" });

    expect(state.phase).toBe("open");
  });

  test("changing the goal unreadies everyone", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "setGoal", goal: "100%" });

    expect(state.entrants.every((e) => !e.ready)).toBe(true);
  });

  test("tick starts the race when the countdown ends", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "ready", entrantId: "b" }, 1_000);

    expect(run(state, { type: "tick" }, startedAt - 1).phase).toBe("countdown");
    expect(run(state, { type: "tick" }, startedAt).phase).toBe("running");
  });
});

describe("finishing", () => {
  test("done records the time since the start", () => {
    const state = run(running(), { type: "done", entrantId: "a" }, startedAt + 65_432);

    expect(state.entrants[0]?.result).toEqual({ kind: "done", timeMs: 65_432 });
  });

  // Guards against a stray click right after GO, like racetime's 5 second rule.
  test("refuses done or forfeit in the first 5 seconds", () => {
    expect(refusal(running(), { type: "done", entrantId: "a" }, startedAt + 4_999)).toBe(
      "tooEarly",
    );
    expect(refusal(running(), { type: "forfeit", entrantId: "a" }, startedAt + 4_999)).toBe(
      "tooEarly",
    );
  });

  test("refuses done twice", () => {
    const state = run(running(), { type: "done", entrantId: "a" }, startedAt + 6_000);

    expect(refusal(state, { type: "done", entrantId: "a" }, startedAt + 7_000)).toBe(
      "alreadyFinished",
    );
  });

  test("finishes the race once everyone is done or forfeit", () => {
    let state = run(running(), { type: "done", entrantId: "a" }, startedAt + 6_000);
    expect(state.phase).toBe("running");

    state = run(state, { type: "forfeit", entrantId: "b" }, startedAt + 7_000);
    expect(state.phase).toBe("finished");
    expect(state.endedAt).toBe(startedAt + 7_000);
  });

  test("undone puts the entrant back and reopens a finished race", () => {
    let state = run(running(), { type: "done", entrantId: "a" }, startedAt + 6_000);
    state = run(state, { type: "forfeit", entrantId: "b" }, startedAt + 7_000);
    state = run(state, { type: "undone", entrantId: "a" }, startedAt + 8_000);

    expect(state.phase).toBe("running");
    expect(state.endedAt).toBeNull();
    expect(state.entrants[0]?.result).toBeNull();
  });

  test("unforfeit puts the entrant back", () => {
    let state = run(running(), { type: "forfeit", entrantId: "b" }, startedAt + 6_000);
    state = run(state, { type: "unforfeit", entrantId: "b" }, startedAt + 7_000);

    expect(state.entrants[1]?.result).toBeNull();
  });

  test("refuses undone without a done, unforfeit without a forfeit", () => {
    expect(refusal(running(), { type: "undone", entrantId: "a" })).toBe("notDone");
    expect(refusal(running(), { type: "unforfeit", entrantId: "a" })).toBe("notForfeit");
  });

  test("refuses actions from someone who never joined", () => {
    expect(refusal(running(), { type: "done", entrantId: "x" }, startedAt + 6_000)).toBe(
      "notEntrant",
    );
  });
});

describe("standings", () => {
  test("ranks done by time, forfeits last, racing in between", () => {
    let state = createRace({ countdownMs });
    state = run(state, { type: "setGoal", goal: "any%" });
    for (const [id, name] of [
      ["a", "alice"],
      ["b", "bob"],
      ["c", "carol"],
      ["d", "dave"],
    ] as const) {
      state = run(state, { type: "join", entrantId: id, name });
      state = run(state, { type: "ready", entrantId: id });
    }
    state = run(state, { type: "tick" }, countdownMs);
    state = run(state, { type: "forfeit", entrantId: "a" }, countdownMs + 6_000);
    state = run(state, { type: "done", entrantId: "b" }, countdownMs + 9_000);
    state = run(state, { type: "done", entrantId: "d" }, countdownMs + 8_000);

    expect(standings(state).map((s) => [s.name, s.place])).toEqual([
      ["dave", 1],
      ["bob", 2],
      ["carol", null],
      ["alice", null],
    ]);
  });
});

describe("ending and rematching", () => {
  test("end terminates a race in any phase before it is over", () => {
    const state = run(running(), { type: "end" }, startedAt + 1_000);

    expect(state.phase).toBe("terminated");
    expect(state.endedAt).toBe(startedAt + 1_000);
    expect(refusal(state, { type: "end" })).toBe("wrongPhase");
  });

  test("ending during the countdown leaves no start time behind", () => {
    let state = run(twoJoined(), { type: "ready", entrantId: "a" });
    state = run(state, { type: "ready", entrantId: "b" });

    state = run(state, { type: "end" }, 2_000);

    expect(state.phase).toBe("terminated");
    expect(state.startsAt).toBeNull();
  });

  // SRL: a terminated or finished race can .rematch, which reopens entry with the same goal.
  test("rematch reopens entry with the same goal and nobody entered", () => {
    let state = run(running(), { type: "done", entrantId: "a" }, startedAt + 6_000);
    state = run(state, { type: "forfeit", entrantId: "b" }, startedAt + 7_000);
    state = run(state, { type: "rematch" });

    expect(state).toEqual({ ...createRace({ countdownMs, fractionDigits: 0 }), goal: "any%" });
    expect(run(run(running(), { type: "end" }), { type: "rematch" }).phase).toBe("open");
  });

  test("refuses rematch while the race is still on", () => {
    expect(refusal(running(), { type: "rematch" })).toBe("wrongPhase");
  });

  test("remove takes an entrant out before the start only", () => {
    const state = run(twoJoined(), { type: "remove", targetId: "b" });

    expect(state.entrants.map((e) => e.name)).toEqual(["alice"]);
    expect(refusal(running(), { type: "remove", targetId: "b" })).toBe("wrongPhase");
    expect(refusal(twoJoined(), { type: "remove", targetId: "x" })).toBe("notEntrant");
  });
});

describe("fraction digits", () => {
  test("rooms start at whole seconds like SRL", () => {
    expect(createRace({ countdownMs }).settings.fractionDigits).toBe(0);
  });

  test("setFractionDigits changes the room default in any phase", () => {
    expect(run(running(), { type: "setFractionDigits", digits: 3 }).settings.fractionDigits).toBe(
      3,
    );
  });
});

describe("entrant cap", () => {
  test("refuses joining a full race", () => {
    let state = createRace({ countdownMs });
    for (let i = 0; i < 50; i++) {
      state = run(state, { type: "join", entrantId: `e${i}`, name: `racer${i}` });
    }

    expect(refusal(state, { type: "join", entrantId: "late", name: "late" })).toBe("raceFull");
  });
});

describe("text cleaning", () => {
  test("strips control and invisible characters from names", () => {
    let state = createRace({ countdownMs });
    state = run(state, { type: "join", entrantId: "a", name: "bob" });
    expect(refusal(state, { type: "join", entrantId: "b", name: "bo\u0000b" })).toBe("nameTaken");
    expect(refusal(state, { type: "join", entrantId: "b", name: "b\u200bob" })).toBe("nameTaken");

    state = run(state, { type: "join", entrantId: "c", name: "al\u0007ice" });
    expect(state.entrants[1]?.name).toBe("alice");
  });

  test("treats look-alike full-width letters as the same name", () => {
    let state = createRace({ countdownMs });
    state = run(state, { type: "join", entrantId: "a", name: "bob" });

    expect(refusal(state, { type: "join", entrantId: "b", name: "\uff42\uff4f\uff42" })).toBe(
      "nameTaken",
    );
  });

  test("strips control characters from goals", () => {
    const state = run(createRace({ countdownMs }), { type: "setGoal", goal: "any%\u001b[31m" });

    expect(state.goal).toBe("any%[31m");
  });

  test("a name of only invisible characters is refused", () => {
    expect(
      refusal(createRace({ countdownMs }), { type: "join", entrantId: "a", name: "\u200b\u0000" }),
    ).toBe("badName");
  });
});
