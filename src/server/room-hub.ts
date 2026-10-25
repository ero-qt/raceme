import type { ServerWebSocket } from "bun";
import type { NewFeedEntry } from "../shared/feed-entry.ts";
import type { ServerMessage } from "../shared/protocol.ts";
import { countdownCalls } from "../shared/race/racebot.ts";
import { applyAndAnnounce, nextTickDelay } from "./room-actions.ts";
import type { Room } from "./rooms.ts";

// Tells the client the room is gone for good, so it stops reconnecting.

export const roomGoneCode = 4404;

/** Turns RaceBot's texts into feed lines stamped with the server time. */
export function botLines(texts: string[], now: number): NewFeedEntry[] {
  return texts.map((text) => ({ kind: "bot", text, at: now }));
}

/** Tracks each room's open sockets and countdown timers to send room updates to everyone in it. */
export class RoomHub<Data> {
  readonly #sockets = new Map<string, Set<ServerWebSocket<Data>>>();
  readonly #countdowns = new Map<string, Timer[]>();

  constructor(
    readonly publish: (slug: string, message: string) => void,
    readonly clock: () => number,
  ) {}

  join(room: Room, socket: ServerWebSocket<Data>): void {
    socket.subscribe(room.slug);
    const sockets = this.#sockets.get(room.slug) ?? new Set();
    sockets.add(socket);
    this.#sockets.set(room.slug, sockets);
  }

  /** Forgets a socket, returning whether it was still in a live room. */
  leave(slug: string, socket: ServerWebSocket<Data>): boolean {
    return this.#sockets.get(slug)?.delete(socket) ?? false;
  }

  publishState(room: Room): void {
    this.#send(room, this.state(room));
  }

  /** Builds the room's current state message, for everyone or for one new socket. */
  state(room: Room): ServerMessage {
    return {
      type: "state",
      race: room.race,
      serverNow: this.clock(),
      closesAt: room.closesAt,
      watchers: room.watcherCount,
    };
  }

  publishLines(room: Room, lines: NewFeedEntry[]): void {
    if (lines.length > 0) {
      this.#send(room, { type: "feed", entries: room.feed.add(lines) });
    }
  }

  /** Schedules RaceBot's 5 to 1 calls and the GO tick for a running countdown. */
  scheduleCountdown(room: Room): void {
    this.clearCountdown(room.slug);

    const now = this.clock();
    const delay = nextTickDelay(room.race, now);
    if (delay === null || room.race.startsAt === null) {
      return;
    }

    const calls = countdownCalls(room.race.startsAt)
      .filter((call) => call.at >= now)
      .map((call) =>
        setTimeout(
          () => this.publishLines(room, botLines([call.text], this.clock())),
          call.at - now,
        ),
      );
    const go = setTimeout(() => this.#go(room), delay);
    this.#countdowns.set(room.slug, [...calls, go]);
  }

  clearCountdown(slug: string): void {
    for (const timer of this.#countdowns.get(slug) ?? []) {
      clearTimeout(timer);
    }
    this.#countdowns.delete(slug);
  }

  /** Tells a room it ends at `closesAt` unless someone acts before then. */
  warnIdle(room: Room, closesAt: number, quietFor: string): void {
    this.#send(room, { type: "idleWarning", closesAt, quietFor });
    this.publishLines(room, botLines(["Room closes soon due to inactivity!"], this.clock()));
  }

  /** Tells a warned room that someone acted, so it stays open. */
  clearIdle(room: Room): void {
    this.#send(room, { type: "idleCleared" });
  }

  /** Stops a dropped room's countdown and closes its sockets with the room-gone code. */
  closeRoom(slug: string, reason = "room gone"): void {
    this.clearCountdown(slug);
    for (const socket of this.#sockets.get(slug) ?? []) {
      socket.close(roomGoneCode, reason);
    }
    this.#sockets.delete(slug);
  }

  stop(): void {
    for (const slug of this.#countdowns.keys()) {
      this.clearCountdown(slug);
    }
  }

  #go(room: Room): void {
    this.#countdowns.delete(room.slug);

    const now = this.clock();
    const result = applyAndAnnounce(room.race, { type: "tick" }, now);
    if (result.ok && result.state !== room.race) {
      room.race = result.state;
      this.publishState(room);
      this.publishLines(room, botLines(result.lines, now));
      return;
    }

    // A timer can fire before the clock reaches GO, so it waits again instead of stalling.
    const delay = nextTickDelay(room.race, now);
    if (delay !== null) {
      this.#countdowns.set(room.slug, [setTimeout(() => this.#go(room), delay)]);
    }
  }

  #send(room: Room, message: ServerMessage): void {
    this.publish(room.slug, JSON.stringify(message));
  }
}
