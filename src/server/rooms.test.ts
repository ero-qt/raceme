import { describe, expect, test } from "bun:test";
import { loadConfig } from "../config.ts";
import type { Entrant } from "../shared/race/race.ts";
import {
  type CreateRoomResult,
  type Room,
  RoomRegistry,
  type RoomRegistryOptions,
} from "./rooms.ts";

const settings = { countdownMs: 10_000 };

const timings = loadConfig({});

function sweptSlugs(rooms: RoomRegistry, now: number): string[] {
  return rooms.sweep(now).map((dropped) => dropped.slug);
}

function registry(options: Partial<RoomRegistryOptions> = {}) {
  return new RoomRegistry({
    ...timings,
    maxRooms: 3,
    idleMs: 60_000,
    abandonedRoomHeadroom: 0,
    ...options,
  });
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

    sweptSlugs(rooms, 60_001);

    expect(rooms.get(stale.slug)).toBeUndefined();
    expect(rooms.get(fresh.slug)).toBe(fresh);
  });

  // SRL: "Race terminated. The channel will be cleared in 10 minutes!"
  test("drops a room once its clear time has passed, even when active", () => {
    const rooms = registry({ idleMs: 3_600_000 });
    const room = created(rooms.create(settings, 0)).room;
    room.clearAt = 600_000;
    room.touch(599_000);

    expect(sweptSlugs(rooms, 599_999)).toEqual([]);
    expect(sweptSlugs(rooms, 600_000)).toEqual([room.slug]);
    expect(rooms.get(room.slug)).toBeUndefined();
  });

  test("never idles a room someone is connected to", () => {
    const rooms = registry({ idleMs: 60_000 });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");

    room.connect(0);
    expect(sweptSlugs(rooms, 2 * 60 * 60_000)).toEqual([]);

    room.disconnect(2 * 60 * 60_000);
    expect(sweptSlugs(rooms, 2 * 60 * 60_000 + 60_001)).toEqual([room.slug]);
  });

  // Keeps one visitor from filling the room cap with lobbies nobody ever joins.
  test("drops a room nobody entered and nobody is in after 10 minutes", () => {
    const rooms = registry({ idleMs: 6 * 60 * 60_000 });
    const empty = created(rooms.create(settings, 0)).room;
    const used = created(rooms.create(settings, 0)).room;
    withEntrant(used, "a");

    expect(sweptSlugs(rooms, 10 * 60_000)).toEqual([]);
    expect(sweptSlugs(rooms, 10 * 60_000 + 1)).toEqual([empty.slug]);
  });
});

describe("Room session limit", () => {
  test("hands out 600 entrant ids per room, so 300 entrants and as many watchers fit", () => {
    const room = created(registry().create(settings, 0)).room;
    for (let i = 0; i < 600; i++) {
      expect(room.entrantIdFor(`secret-${i}`)).not.toBeNull();
    }
    expect(room.entrantIdFor("secret-600")).toBeNull();
  });
});

describe("RoomRegistry.peopleCount", () => {
  test("counts each session once across its tabs and drops a room's people with the room", () => {
    const rooms = registry({ idleMs: 100 * 60 * 60_000, roomLifetimeMs: 72 * 60 * 60_000 });
    const room = created(rooms.create(settings, 0)).room;
    const other = created(rooms.create(settings, 0)).room;
    room.attachSession("a");
    room.attachSession("a");
    room.attachSession("b");
    other.attachSession("c");
    expect(rooms.peopleCount).toBe(3);

    room.detachSession("a");
    expect(rooms.peopleCount).toBe(3);
    room.detachSession("a");
    expect(rooms.peopleCount).toBe(2);

    rooms.sweep(72 * 60 * 60_000);
    expect(rooms.peopleCount).toBe(0);
  });

  test("detaching a session that never attached changes nothing", () => {
    const rooms = registry();
    const room = created(rooms.create(settings, 0)).room;
    room.detachSession("never-attached");
    expect(rooms.peopleCount).toBe(0);
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

    expect(sweptSlugs(rooms, 72 * 60 * 60_000 - 1)).toEqual([]);
    expect(sweptSlugs(rooms, 72 * 60 * 60_000)).toEqual([room.slug]);
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

    expect(sweptSlugs(rooms, hours(2) + 10 * 60_000 - 1)).toEqual([]);
    expect(sweptSlugs(rooms, hours(2) + 10 * 60_000)).toEqual([room.slug]);
  });

  test("never treats a room as idle while someone is still racing", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.race = { ...room.race, phase: "running", startsAt: 0 };
    room.connect(0);

    expect(rooms.idleWarnings(hours(5))).toEqual([]);
    expect(sweptSlugs(rooms, hours(5))).toEqual([]);
  });

  // Closed and hibernated tabs both drop their sockets, so the server can't tell them apart.
  test("a race with every tab gone falls back to the empty room rule", () => {
    const rooms = registry({ idleMs: hours(6) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    room.race = { ...room.race, phase: "running", startsAt: 0 };

    expect(sweptSlugs(rooms, hours(5))).toEqual([]);
    expect(sweptSlugs(rooms, hours(6) + 1)).toEqual([room.slug]);
  });

  test("input clears the warning and starts the 2 hours over", () => {
    const rooms = registry({ idleMs: hours(100) });
    const room = created(rooms.create(settings, 0)).room;
    withEntrant(room, "a");
    rooms.idleWarnings(hours(2));

    expect(room.noteInput(hours(2) + 60_000)).toBe(true);
    expect(room.noteInput(hours(2) + 120_000)).toBe(false);
    expect(sweptSlugs(rooms, hours(3))).toEqual([]);
  });
});

describe("RoomRegistry close reasons", () => {
  const hours = (n: number) => n * 60 * 60_000;

  test("says why each room closed", () => {
    const rooms = registry({ idleMs: hours(2), roomLifetimeMs: hours(48) });
    const ended = created(rooms.create(settings, 0)).room;
    withEntrant(ended, "a");
    ended.clearAt = 60_000;
    const quiet = created(rooms.create(settings, 0)).room;
    withEntrant(quiet, "b");
    quiet.connect(0);

    expect(rooms.sweep(60_000)).toEqual([{ slug: ended.slug, reason: "ended" }]);
    expect(rooms.sweep(hours(2) + 10 * 60_000)).toEqual([{ slug: quiet.slug, reason: "idle" }]);
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

describe("Room.watcherCount", () => {
  test("counts each open session that hasn't entered once, however many tabs it has", () => {
    const room = created(registry().create(settings, 0)).room;
    const racer = room.entrantIdFor("racer-secret") ?? "";
    room.entrantIdFor("watcher-secret");
    withEntrant(room, racer);

    room.attachSession("racer-secret");
    room.attachSession("watcher-secret");
    room.attachSession("watcher-secret");
    expect(room.watcherCount).toBe(1);

    room.detachSession("watcher-secret");
    room.detachSession("watcher-secret");
    expect(room.watcherCount).toBe(0);
  });
});

describe("RoomRegistry queued restart", () => {
  const hours = (n: number) => n * 60 * 60_000;
  const quiet = { idleMs: hours(100), idleInputMs: hours(100) };

  test("moves every room's close time up to the restart, also for rooms opened later", () => {
    const rooms = registry(quiet);
    const early = created(rooms.create(settings, 0)).room;

    rooms.queueRestart(hours(5));
    const late = created(rooms.create(settings, hours(1))).room;

    expect([early.closesAt, late.closesAt]).toEqual([hours(5), hours(5)]);
    expect([early.closesFor, late.closesFor]).toEqual(["restart", "restart"]);
  });

  test("keeps the room lifetime when it ends before the restart", () => {
    const rooms = registry({ ...quiet, roomLifetimeMs: hours(2) });
    const room = created(rooms.create(settings, 0)).room;

    rooms.queueRestart(hours(5));

    expect([room.closesAt, room.closesFor]).toEqual([hours(2), "lifetime"]);
  });

  test("warns 1 hour before the restart and closes the rooms at it", () => {
    const rooms = registry(quiet);
    const room = created(rooms.create(settings, 0)).room;
    rooms.queueRestart(hours(5));

    expect(rooms.closingSoon(hours(4) - 1)).toEqual([]);
    expect(rooms.closingSoon(hours(4))).toEqual([room.slug]);
    expect(rooms.sweep(hours(5))).toEqual([{ slug: room.slug, reason: "restart" }]);
  });
});

describe("RoomRegistry abandoned rooms", () => {
  const minutes = (n: number) => n * 60_000;
  const options = {
    maxRooms: 4,
    idleMs: minutes(120),
    idleInputMs: minutes(600),
    unusedRoomMs: minutes(600),
    abandonedAfterMs: minutes(10),
    abandonedRoomHeadroom: 1,
  };

  function openAndLeave(rooms: RoomRegistry, at: number): Room {
    const room = created(rooms.create(settings, at)).room;
    withEntrant(room, `e${at}`);
    room.connect(at);
    room.disconnect(at);
    return room;
  }

  test("frees the longest-abandoned rooms once fewer than the headroom are left free", () => {
    const rooms = registry(options);
    const oldest = openAndLeave(rooms, 0);
    const older = openAndLeave(rooms, minutes(1));
    const live = created(rooms.create(settings, minutes(2))).room;
    live.connect(minutes(2));

    const dropped = rooms.sweep(minutes(12));

    expect(dropped).toEqual([]);
    openAndLeave(rooms, minutes(3));
    expect(rooms.sweep(minutes(14)).map((d) => d.slug)).toEqual([oldest.slug]);
    expect(rooms.get(older.slug)).toBeDefined();
    expect(rooms.get(live.slug)).toBe(live);
  });

  test("closes every room for a queued restart once only abandoned rooms are left", () => {
    const rooms = registry(options);
    const abandoned = openAndLeave(rooms, 0);
    const recent = openAndLeave(rooms, minutes(5));
    rooms.queueRestart(minutes(600));

    expect(rooms.sweep(minutes(12))).toEqual([]);
    expect(rooms.sweep(minutes(15))).toEqual([
      { slug: abandoned.slug, reason: "restart" },
      { slug: recent.slug, reason: "restart" },
    ]);
  });

  test("keeps abandoned rooms for a queued restart while someone is still in another room", () => {
    const rooms = registry(options);
    openAndLeave(rooms, 0);
    created(rooms.create(settings, 0)).room.connect(0);
    rooms.queueRestart(minutes(600));

    expect(rooms.sweep(minutes(30))).toEqual([]);
  });
});
