import { describe, expect, test } from "bun:test";
import type { Entrant } from "../shared/race/race.ts";
import { type CreateRoomResult, type Room, RoomRegistry } from "./rooms.ts";

const settings = { countdownMs: 10_000 };

function registry(
  options: Partial<{ maxRooms: number; idleMs: number; roomLifetimeMs: number }> = {},
) {
  return new RoomRegistry({ maxRooms: 3, idleMs: 60_000, ...options });
}

function created(result: CreateRoomResult): Extract<CreateRoomResult, { ok: true }> {
  if (!result.ok) {
    throw new Error("expected a room");
  }
  return result;
}

function withEntrant(room: Room, id: string): void {
  const entrant: Entrant = { id, name: id, ready: false, result: null };
  room.race = { ...room.race, entrants: [entrant] };
}

describe("RoomRegistry", () => {
  test("creates rooms with distinct url-safe slugs", () => {
    const rooms = registry();

    const a = created(rooms.create(settings, 0)).room;
    const b = created(rooms.create(settings, 0)).room;

    expect(a.slug).toMatch(/^[a-z2-7]{10}$/);
    expect(a.slug).not.toBe(b.slug);
    expect(rooms.get(a.slug)).toBe(a);
  });

  test("returns a host token only the creator gets", () => {
    const { room, hostToken } = created(registry().create(settings, 0));

    expect(hostToken.length).toBeGreaterThanOrEqual(40);
    expect(room.isHost(hostToken)).toBe(true);
    expect(room.isHost("guess")).toBe(false);
    expect(JSON.stringify(room.race)).not.toContain(hostToken);
  });

  test("refuses new rooms past the cap", () => {
    const rooms = registry({ maxRooms: 1 });
    rooms.create(settings, 0);

    expect(rooms.create(settings, 0)).toEqual({ ok: false, refusal: "full" });
  });

  test("unknown slugs return undefined", () => {
    expect(registry().get("aaaaaaaaaa")).toBeUndefined();
  });
});

describe("RoomRegistry.sweep", () => {
  test("drops rooms idle for longer than idleMs", () => {
    const rooms = registry();
    const stale = created(rooms.create(settings, 0)).room;
    const fresh = created(rooms.create(settings, 0)).room;
    fresh.touch(50_000);

    rooms.sweep(60_001);

    expect(rooms.get(stale.slug)).toBeUndefined();
    expect(rooms.get(fresh.slug)).toBe(fresh);
  });

  // SRL: "Race terminated. The channel will be cleared in 10 minutes!"
  test("drops a room once its clear time has passed, even when active", () => {
    const rooms = registry({ idleMs: 3_600_000 });
    const room = created(rooms.create(settings, 0)).room;
    room.clearAt = 600_000;
    room.touch(599_000);

    expect(rooms.sweep(599_999)).toEqual([]);
    expect(rooms.sweep(600_000)).toEqual([room.slug]);
    expect(rooms.get(room.slug)).toBeUndefined();
  });

  test("never idles a room someone is connected to", () => {
    const rooms = registry({ idleMs: 60_000 });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");

    room.connect(0);
    expect(rooms.sweep(2 * 60 * 60_000)).toEqual([]);

    room.disconnect(2 * 60 * 60_000);
    expect(rooms.sweep(2 * 60 * 60_000 + 60_001)).toEqual([room.slug]);
  });

  // Keeps one visitor from filling the room cap with lobbies nobody ever joins.
  test("drops a room nobody entered and nobody is in after 10 minutes", () => {
    const rooms = registry({ idleMs: 6 * 60 * 60_000 });
    const empty = created(rooms.create(settings, 0)).room;
    const used = created(rooms.create(settings, 0)).room;
    withEntrant(used, "a");

    expect(rooms.sweep(10 * 60_000)).toEqual([]);
    expect(rooms.sweep(10 * 60_000 + 1)).toEqual([empty.slug]);
  });
});

describe("RoomRegistry lifetime", () => {
  test("drops every room once its lifetime is over, even with people in it", () => {
    const rooms = registry({ idleMs: 100 * 60 * 60_000, roomLifetimeMs: 72 * 60 * 60_000 });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.connect(0);
    room.touch(72 * 60 * 60_000 - 1);
    room.noteInput(72 * 60 * 60_000 - 1);

    expect(rooms.sweep(72 * 60 * 60_000 - 1)).toEqual([]);
    expect(rooms.sweep(72 * 60 * 60_000)).toEqual([room.slug]);
  });

  test("names each room once when it has 1 hour left", () => {
    const rooms = registry({ idleMs: 100 * 60 * 60_000, roomLifetimeMs: 72 * 60 * 60_000 });
    const room = created(rooms.create(settings, 0)).room;

    expect(rooms.closingSoon(71 * 60 * 60_000 - 1)).toEqual([]);
    expect(rooms.closingSoon(71 * 60 * 60_000)).toEqual([room.slug]);
    expect(rooms.closingSoon(71 * 60 * 60_000 + 1)).toEqual([]);
  });
});

describe("RoomRegistry idle rooms", () => {
  const hours = (n: number) => n * 60 * 60_000;

  test("warns once after 2 hours without input, even with tabs open", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    room.connect(0);

    expect(rooms.idleWarnings(hours(2) - 1)).toEqual([]);
    expect(rooms.idleWarnings(hours(2))).toEqual([room.slug]);
    expect(rooms.idleWarnings(hours(2) + 1)).toEqual([]);
  });

  test("drops a room 10 minutes after the warning when nobody acts", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.connect(0);

    expect(rooms.sweep(hours(2) + 10 * 60_000 - 1)).toEqual([]);
    expect(rooms.sweep(hours(2) + 10 * 60_000)).toEqual([room.slug]);
  });

  test("never treats a room as idle while someone is still racing", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.race = { ...room.race, phase: "running", startsAt: 0 };
    room.connect(0);

    expect(rooms.idleWarnings(hours(5))).toEqual([]);
    expect(rooms.sweep(hours(5))).toEqual([]);
  });

  // Closed and hibernated tabs both drop their sockets, so the server can't tell them apart.
  test("a race with every tab gone falls back to the empty room rule", () => {
    const rooms = registry({ idleMs: hours(6) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.race = { ...room.race, phase: "running", startsAt: 0 };

    expect(rooms.sweep(hours(5))).toEqual([]);
    expect(rooms.sweep(hours(6) + 1)).toEqual([room.slug]);
  });

  test("input clears the warning and starts the 2 hours over", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    rooms.idleWarnings(hours(2));

    expect(room.noteInput(hours(2) + 60_000)).toBe(true);
    expect(room.noteInput(hours(2) + 120_000)).toBe(false);
    expect(rooms.sweep(hours(3))).toEqual([]);
  });
});

describe("RoomRegistry.sweepWithReasons", () => {
  const hours = (n: number) => n * 60 * 60_000;

  test("says why each room closed", () => {
    const rooms = registry({ idleMs: hours(2), roomLifetimeMs: hours(48) });
    const ended = created(rooms.create(settings, 0)).room;
    withEntrant(ended, "a");
    ended.clearAt = 60_000;
    const quiet = created(rooms.create(settings, 0)).room;
    withEntrant(quiet, "b");
    quiet.connect(0);

    expect(rooms.sweepWithReasons(60_000)).toEqual([{ slug: ended.slug, reason: "ended" }]);
    expect(rooms.sweepWithReasons(hours(2) + 10 * 60_000)).toEqual([
      { slug: quiet.slug, reason: "idle" },
    ]);
  });
});

describe("Room sessions", () => {
  test("frees the id of a session that leaves without entering", () => {
    const room = created(registry().create(settings, 0)).room;
    const first = room.entrantIdFor("visitor");

    room.attachSession("visitor");
    room.detachSession("visitor");

    expect(room.entrantIdFor("visitor")).not.toBe(first);
  });

  test("keeps the id of an entrant", () => {
    const room = created(registry().create(settings, 0)).room;
    const racer = room.entrantIdFor("racer") ?? "";
    withEntrant(room, racer);

    room.attachSession("racer");
    room.detachSession("racer");

    expect(room.entrantIdFor("racer")).toBe(racer);
  });

  test("a failed upgrade keeps the id of a session with tabs still open", () => {
    const room = created(registry().create(settings, 0)).room;
    const watcher = room.entrantIdFor("watcher");
    room.attachSession("watcher");

    room.releaseUnusedSession("watcher");

    expect(room.entrantIdFor("watcher")).toBe(watcher);
  });

  test("keeps the id of a session with another tab still open", () => {
    const room = created(registry().create(settings, 0)).room;
    const watcher = room.entrantIdFor("watcher");

    room.attachSession("watcher");
    room.attachSession("watcher");
    room.detachSession("watcher");

    expect(room.entrantIdFor("watcher")).toBe(watcher);
  });
});
