import { describe, expect, test } from "bun:test";
import { loadConfig } from "../config.ts";
import { chatLine, handleAction, nextTickDelay } from "./room-actions.ts";
import { RoomRegistry } from "./rooms.ts";

const guest = { entrantId: "a", isHost: false };
const host = { entrantId: "a", isHost: true };
const notHost = { ok: false, refusal: "notHost" } as const;

function room() {
  const created = new RoomRegistry({ ...loadConfig({}), maxRooms: 1, idleMs: 1 }).create(
    { countdownMs: 10_000 },
    0,
  );
  if (!created.ok) {
    throw new Error("expected a room");
  }
  return created.room;
}

describe("handleAction", () => {
  test("only the host may set the goal", () => {
    const r = room();
    const action = { type: "setGoal", goal: "x" } as const;

    expect(handleAction(r, guest, action, 0)).toEqual(notHost);
    expect(handleAction(r, host, action, 0).ok).toBe(true);
  });

  test("only the host may end a race or remove an entrant", () => {
    const r = room();

    expect(handleAction(r, guest, { type: "end" }, 0)).toEqual(notHost);
    expect(handleAction(r, guest, { type: "remove", entrantId: "b" }, 0)).toEqual(notHost);
  });

  test("only the host may lock entry", () => {
    expect(handleAction(room(), guest, { type: "lock" }, 0)).toEqual(notHost);
    expect(handleAction(room(), host, { type: "lock" }, 0).ok).toBe(true);
  });

  test("only the host may cap the entrants", () => {
    const action = { type: "setEntrantCap", cap: 4 } as const;

    expect(handleAction(room(), guest, action, 0)).toEqual(notHost);
    expect(handleAction(room(), host, action, 0).ok).toBe(true);
  });

  test("only the host may set the room's fraction digits", () => {
    const r = room();
    const action = { type: "setFractionDigits", digits: 2 } as const;

    expect(handleAction(r, guest, action, 0)).toEqual(notHost);
    expect(handleAction(r, host, action, 0).ok).toBe(true);
  });

  test("acts as the session's own entrant", () => {
    const result = handleAction(room(), guest, { type: "join", name: "al" }, 0);

    expect(result.ok && result.state.entrants[0]?.id).toBe("a");
    expect(result.ok && result.lines).toEqual(["al enters the race! 1 entrant."]);
  });

  test("only the host or an entrant may rematch, so a watcher can't wipe the results", () => {
    const r = room();
    const joined = handleAction(r, guest, { type: "join", name: "al" }, 0);
    if (joined.ok) {
      r.race = { ...joined.state, phase: "terminated", endedAt: 1 };
    }
    const watcher = { entrantId: "w", isHost: false };

    expect(handleAction(r, watcher, { type: "rematch" }, 2)).toEqual({
      ok: false,
      refusal: "notEntrant",
    });
    expect(handleAction(r, guest, { type: "rematch" }, 2).ok).toBe(true);
    expect(handleAction(r, { entrantId: "w", isHost: true }, { type: "rematch" }, 2).ok).toBe(true);
  });
});

describe("chatLine", () => {
  test("strips control characters so a message can't fake extra lines", () => {
    const r = room();
    const joined = handleAction(r, guest, { type: "join", name: "al" }, 0);
    if (joined.ok) {
      r.race = joined.state;
    }

    expect(chatLine(r, guest, "gl\n<RaceBot> GO!", 5, 0)).toEqual({
      kind: "chat",
      name: "al",
      text: "gl<RaceBot> GO!",
      at: 5,
    });
    expect(chatLine(r, guest, "hi\u2028<RaceBot> GO!\u202e", 5, 0)).toMatchObject({
      text: "hi<RaceBot> GO!",
    });
    expect(chatLine(r, guest, " \u0007 ", 5, 0)).toBe("badChat");
  });

  test("lets each entrant send 1 line per interval, and a refused line doesn't count", () => {
    const r = room();
    const joined = handleAction(r, guest, { type: "join", name: "al" }, 0);
    if (joined.ok) {
      r.race = joined.state;
    }

    expect(chatLine(r, guest, "", 1_000, 3_000)).toBe("badChat");
    expect(chatLine(r, guest, "hi", 1_000, 3_000)).toMatchObject({ text: "hi" });
    expect(chatLine(r, guest, "again", 3_999, 3_000)).toBe("slowMode");
    expect(chatLine(r, guest, "again", 4_000, 3_000)).toMatchObject({ text: "again" });
  });

  test("refuses chat from an entrant the host muted, and only the host may mute", () => {
    const r = room();
    const joined = handleAction(r, guest, { type: "join", name: "al" }, 0);
    if (joined.ok) {
      r.race = joined.state;
    }
    const mute = { type: "mute", entrantId: "a" } as const;

    expect(handleAction(r, guest, mute, 0)).toEqual(notHost);
    const muted = handleAction(r, host, mute, 0);
    if (muted.ok) {
      r.race = muted.state;
    }

    expect(chatLine(r, guest, "hi", 0, 0)).toBe("muted");
  });

  test("takes lines up to 512 characters", () => {
    const r = room();
    const joined = handleAction(r, guest, { type: "join", name: "al" }, 0);
    if (joined.ok) {
      r.race = joined.state;
    }

    expect(chatLine(r, guest, "x".repeat(513), 0, 0)).toBe("badChat");
    expect(chatLine(r, guest, "x".repeat(512), 0, 0)).toMatchObject({ text: "x".repeat(512) });
  });
});

describe("Room.entrantIdFor", () => {
  test("gives each session one stable public id that differs from the session secret", () => {
    const r = room();

    const id = r.entrantIdFor("secret-1");

    expect(id).not.toBeNull();
    expect(id).not.toContain("secret");
    expect(r.entrantIdFor("secret-1")).toBe(id);
    expect(r.entrantIdFor("secret-2")).not.toBe(id);
  });
});

describe("nextTickDelay", () => {
  test("waits until GO during the countdown, never otherwise", () => {
    const { race } = room();

    expect(nextTickDelay(race, 0)).toBeNull();
    expect(nextTickDelay({ ...race, phase: "countdown", startsAt: 9_000 }, 1_000)).toBe(8_000);
    expect(nextTickDelay({ ...race, phase: "countdown", startsAt: 500 }, 1_000)).toBe(0);
  });
});
