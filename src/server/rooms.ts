import { type NewRaceSettings, type RaceState, createRace } from "../shared/race/race.ts";
import { Feed } from "./feed.ts";
import { randomSecret, randomSlug, secretsEqual } from "./tokens.ts";

// 10 base32 characters give 50 bits, far past guessing invite links at any rate the server allows.
const slugLength = 10;
const entrantIdLength = 8;
const maxSessionsPerRoom = 200;
const feedCapacity = 200;

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
  /** Ends the room at this server time, however active it is. */
  readonly expiresAt: number;
  /** Gives the server time of a queued server restart, which closes the room too. */
  restartAt: number | null = null;
  warnedOfClosing = false;
  #lastInputAt: number;
  warnedOfIdle = false;
  /** Maps each entrant id to the server time of their last chat line. */
  readonly #lastChatAt = new Map<string, number>();

  constructor(
    readonly slug: string,
    hostToken: string,
    settings: NewRaceSettings,
    now: number,
    lifetimeMs: number,
  ) {
    this.#hostToken = hostToken;
    this.race = createRace(settings);
    this.#lastActivityAt = now;
    this.openedAt = now;
    this.expiresAt = now + lifetimeMs;
    this.#lastInputAt = now;
  }

  /** Gives the server time the room closes, which comes sooner than `expiresAt` after `.end`. */
  get closesAt(): number {
    return Math.min(this.lastsUntil, this.clearAt ?? this.lastsUntil);
  }

  /** Tells whether the room's lifetime or a queued server restart ends it first. */
  get closesFor(): "lifetime" | "restart" {
    return this.restartAt !== null && this.restartAt < this.expiresAt ? "restart" : "lifetime";
  }

  /** Gives the server time the room's lifetime or a queued restart ends it, `.end` aside. */
  get lastsUntil(): number {
    return Math.min(this.expiresAt, this.restartAt ?? this.expiresAt);
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

  /** Counts a chat line against the entrant's slow mode. Returns false while they must wait. */
  takeChatTurn(entrantId: string, now: number, everyMs: number): boolean {
    const last = this.#lastChatAt.get(entrantId);
    if (last !== undefined && now - last < everyMs) {
      return false;
    }

    this.#lastChatAt.set(entrantId, now);
    return true;
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

  /** Counts the sessions with a tab open that haven't entered, each once however many tabs it has. */
  get watcherCount(): number {
    const entered = new Set(this.race.entrants.map((e) => e.id));
    let count = 0;
    for (const secret of this.#sessionSockets.keys()) {
      const id = this.#entrantIds.get(secret);
      if (id === undefined || !entered.has(id)) {
        count++;
      }
    }
    return count;
  }

  /** Counts the people with this room open, each session once however many tabs it has. */
  get sessionCount(): number {
    return this.#sessionSockets.size;
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
   * Warns a room after this many ms without input and drops it `idleWarningMs` later, because an open
   * tab nobody touches would keep it alive.
   */
  idleInputMs: number;
  /** Gives an idle room this long between the warning and the end. */
  idleWarningMs: number;
  /** Ends every room this long after it opened, however active it is. */
  roomLifetimeMs: number;
  /** Warns a room this long before it reaches `roomLifetimeMs`. */
  closingWarningMs: number;
  /** Drops an empty room nobody ever entered after this long, so lobbies can't fill the cap. */
  unusedRoomMs: number;
}

export type CloseReason = "ended" | "expired" | "restart" | "idle" | "empty";

export interface DroppedRoom {
  slug: string;
  reason: CloseReason;
}

export type CreateRoomResult =
  | { ok: true; room: Room; hostToken: string }
  | { ok: false; refusal: "full" };

/** Keeps every live room in memory, keyed by slug. */
export class RoomRegistry {
  readonly #rooms = new Map<string, Room>();
  #restartAt: number | null = null;

  constructor(readonly options: RoomRegistryOptions) {}

  get size(): number {
    return this.#rooms.size;
  }

  get restartAt(): number | null {
    return this.#restartAt;
  }

  /** Closes every room, open now or opened later, at the server restart's time. */
  queueRestart(at: number): void {
    this.#restartAt = at;
    for (const room of this.#rooms.values()) {
      room.restartAt = at;
    }
  }

  /** Counts the people with any room open, a person in 2 rooms twice. */
  get peopleCount(): number {
    let people = 0;
    for (const room of this.#rooms.values()) {
      people += room.sessionCount;
    }
    return people;
  }

  rooms(): IterableIterator<Room> {
    return this.#rooms.values();
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
    const room = new Room(slug, hostToken, settings, now, this.options.roomLifetimeMs);
    room.restartAt = this.#restartAt;
    this.#rooms.set(slug, room);
    return { ok: true, room, hostToken };
  }

  get(slug: string): Room | undefined {
    return this.#rooms.get(slug);
  }

  /** Lists the rooms that just went `idleInputMs` without input, each room once until input comes. */
  idleWarnings(now: number): string[] {
    const idle: string[] = [];
    for (const [slug, room] of this.#rooms) {
      if (
        !room.warnedOfIdle &&
        !isRacing(room) &&
        now - room.lastInputAt >= this.options.idleInputMs
      ) {
        room.warnedOfIdle = true;
        idle.push(slug);
      }
    }

    return idle;
  }

  /** Lists the rooms that just reached their last hour before their lifetime or a restart ends. */
  closingSoon(now: number): string[] {
    const closing: string[] = [];
    for (const [slug, room] of this.#rooms) {
      if (!room.warnedOfClosing && now >= room.lastsUntil - this.options.closingWarningMs) {
        room.warnedOfClosing = true;
        closing.push(slug);
      }
    }

    return closing;
  }

  sweep(now: number): string[] {
    return this.sweepWithReasons(now).map((dropped) => dropped.slug);
  }

  /** Drops the rooms that are over, each with the reason it closed. */
  sweepWithReasons(now: number): DroppedRoom[] {
    const dropped: DroppedRoom[] = [];
    for (const [slug, room] of this.#rooms) {
      const reason = this.#closeReason(room, now);
      if (reason !== null) {
        this.#rooms.delete(slug);
        dropped.push({ slug, reason });
      }
    }

    return dropped;
  }

  #closeReason(room: Room, now: number): CloseReason | null {
    const quietFor = now - room.lastActivityAt;
    const empty = room.connected === 0;

    if (room.clearAt !== null && now >= room.clearAt) {
      return "ended";
    }
    if (room.restartAt !== null && now >= room.restartAt) {
      return "restart";
    }
    if (now >= room.expiresAt) {
      return "expired";
    }
    if (
      !isRacing(room) &&
      now - room.lastInputAt >= this.options.idleInputMs + this.options.idleWarningMs
    ) {
      return "idle";
    }
    if (empty && room.race.entrants.length === 0 && quietFor > this.options.unusedRoomMs) {
      return "idle";
    }
    if (empty && quietFor > this.options.idleMs) {
      return "empty";
    }
    return null;
  }
}

// Racers watch their game for hours without touching the browser, so a running race never counts
// as idle. The room lifetime still ends a race nobody finishes.
function isRacing(room: Room): boolean {
  const live = room.race.phase === "countdown" || room.race.phase === "running";
  return live && room.race.entrants.some((entrant) => entrant.result === null);
}
