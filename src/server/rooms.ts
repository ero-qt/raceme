import { type NewRaceSettings, type RaceState, createRace } from "../shared/race/race.ts";
import { Feed } from "./feed.ts";
import { randomSecret, randomSlug, secretsEqual } from "./tokens.ts";

// 10 base32 characters give 50 bits, far past guessing invite links at any rate the server allows.
const slugLength = 10;
const entrantIdLength = 8;
const maxSessionsPerRoom = 200;
const feedCapacity = 200;
// Keeps one visitor from filling the room cap with lobbies nobody ever joins.
const unusedRoomMs = 10 * 60_000;
const closingWarningMs = 60 * 60_000;
export const idleGraceMs = 5 * 60_000;

export class Room {
  readonly #hostToken: string;
  /** Maps each session secret to the public entrant id everyone in the room sees. */
  readonly #entrantIds = new Map<string, string>();
  /** Counts the open sockets of each session secret. */
  readonly #sessionSockets = new Map<string, number>();
  readonly feed = new Feed(feedCapacity);
  race: RaceState;
  /** Drops the room at this server time even while people are in it, `null` when not set. */
  clearAt: number | null = null;
  #lastActivityAt: number;
  #connected = 0;
  readonly openedAt: number;
  warnedOfClosing = false;
  #lastInputAt: number;
  warnedOfIdle = false;

  constructor(
    readonly slug: string,
    hostToken: string,
    settings: NewRaceSettings,
    now: number,
  ) {
    this.#hostToken = hostToken;
    this.race = createRace(settings);
    this.#lastActivityAt = now;
    this.openedAt = now;
    this.#lastInputAt = now;
  }

  get lastInputAt(): number {
    return this.#lastInputAt;
  }

  /** Counts a message from a visitor as input. Returns whether that cleared an idle warning. */
  noteInput(now: number): boolean {
    this.#lastInputAt = now;
    const wasWarned = this.warnedOfIdle;
    this.warnedOfIdle = false;
    return wasWarned;
  }

  get lastActivityAt(): number {
    return this.#lastActivityAt;
  }

  isHost(token: string): boolean {
    return secretsEqual(token, this.#hostToken);
  }

  /** Returns the session's entrant id. A room that has seen too many sessions returns `null`. */
  entrantIdFor(sessionSecret: string): string | null {
    const known = this.#entrantIds.get(sessionSecret);
    if (known) {
      return known;
    }
    if (this.#entrantIds.size >= maxSessionsPerRoom) {
      return null;
    }

    const id = randomSlug(entrantIdLength);
    this.#entrantIds.set(sessionSecret, id);
    return id;
  }

  attachSession(sessionSecret: string): void {
    this.#sessionSockets.set(sessionSecret, (this.#sessionSockets.get(sessionSecret) ?? 0) + 1);
  }

  /**
   * Counts a session's socket as closed. A session with no socket left that never entered gives its
   * id back, so visitors with throwaway cookies can't use up the room's session limit.
   */
  detachSession(sessionSecret: string): void {
    const left = (this.#sessionSockets.get(sessionSecret) ?? 1) - 1;
    if (left > 0) {
      this.#sessionSockets.set(sessionSecret, left);
      return;
    }

    this.#sessionSockets.delete(sessionSecret);
    this.releaseUnusedSession(sessionSecret);
  }

  /** Gives back the id of a session with no open socket that never entered. */
  releaseUnusedSession(sessionSecret: string): void {
    if (this.#sessionSockets.has(sessionSecret)) {
      return;
    }

    const id = this.#entrantIds.get(sessionSecret);
    if (id !== undefined && !this.race.entrants.some((e) => e.id === id)) {
      this.#entrantIds.delete(sessionSecret);
    }
  }

  touch(now: number): void {
    this.#lastActivityAt = now;
  }

  get connected(): number {
    return this.#connected;
  }

  connect(now: number): void {
    this.#connected++;
    this.touch(now);
  }

  disconnect(now: number): void {
    this.#connected = Math.max(0, this.#connected - 1);
    this.touch(now);
  }
}

export interface RoomRegistryOptions {
  maxRooms: number;
  /** Drops a room after this many ms with nobody connected and no action in it. */
  idleMs: number;
  /**
   * Warns a room after this many ms without input and drops it 5 minutes later, because an open
   * tab nobody touches would keep it alive. Defaults to 2 hours.
   */
  idleInputMs?: number;
  /** Ends every room this long after it opened, however active it is. Defaults to 48 hours. */
  roomLifetimeMs?: number;
}

export type CreateRoomResult =
  | { ok: true; room: Room; hostToken: string }
  | { ok: false; refusal: "full" };

/** Keeps every live room in memory, keyed by slug. */
export class RoomRegistry {
  readonly #rooms = new Map<string, Room>();

  constructor(readonly options: RoomRegistryOptions) {}

  get #roomLifetimeMs(): number {
    return this.options.roomLifetimeMs ?? 48 * 60 * 60_000;
  }

  get #idleInputMs(): number {
    return this.options.idleInputMs ?? 2 * 60 * 60_000;
  }

  get size(): number {
    return this.#rooms.size;
  }

  create(settings: NewRaceSettings, now: number): CreateRoomResult {
    if (this.#rooms.size >= this.options.maxRooms) {
      return { ok: false, refusal: "full" };
    }

    let slug = randomSlug(slugLength);
    while (this.#rooms.has(slug)) {
      slug = randomSlug(slugLength);
    }

    const hostToken = randomSecret();
    const room = new Room(slug, hostToken, settings, now);
    this.#rooms.set(slug, room);
    return { ok: true, room, hostToken };
  }

  get(slug: string): Room | undefined {
    return this.#rooms.get(slug);
  }

  /** Drops idle rooms and rooms past their clear time, returning their slugs. */
  /** Lists the rooms that just went 2 hours without input, each room once until input comes. */
  idleWarnings(now: number): string[] {
    const idle: string[] = [];
    for (const [slug, room] of this.#rooms) {
      if (!room.warnedOfIdle && now - room.lastInputAt >= this.#idleInputMs) {
        room.warnedOfIdle = true;
        idle.push(slug);
      }
    }

    return idle;
  }

  /** Lists the rooms that just reached their last hour, each room once. */
  closingSoon(now: number): string[] {
    const closing: string[] = [];
    for (const [slug, room] of this.#rooms) {
      if (!room.warnedOfClosing && now >= room.openedAt + this.#roomLifetimeMs - closingWarningMs) {
        room.warnedOfClosing = true;
        closing.push(slug);
      }
    }

    return closing;
  }

  sweep(now: number): string[] {
    const dropped: string[] = [];
    for (const [slug, room] of this.#rooms) {
      const quietFor = now - room.lastActivityAt;
      const empty = room.connected === 0;
      const idle = empty && quietFor > this.options.idleMs;
      const unused = empty && room.race.entrants.length === 0 && quietFor > unusedRoomMs;
      const cleared = room.clearAt !== null && now >= room.clearAt;
      const expired = now >= room.openedAt + this.#roomLifetimeMs;
      const abandoned = now - room.lastInputAt >= this.#idleInputMs + idleGraceMs;

      if (idle || unused || cleared || expired || abandoned) {
        this.#rooms.delete(slug);
        dropped.push(slug);
      }
    }

    return dropped;
  }
}
