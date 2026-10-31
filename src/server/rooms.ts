import type { ServerConfig } from "../config.ts";
import { type NewRaceSettings, type RaceState, createRace } from "../shared/race/race.ts";
import { Feed } from "./feed.ts";
import { randomSecret, randomSlug, secretsEqual } from "./tokens.ts";

// 10 base32 characters give 50 bits, far past guessing invite links at any rate the server allows.
const slugLength = 10;
const entrantIdLength = 8;

export class Room {
  readonly #hostToken: string;
  /** Maps each session secret to the public entrant id everyone in the room sees. */
  readonly #entrantIds = new Map<string, string>();
  /** Counts the open sockets of each session secret. */
  readonly #sessionSockets = new Map<string, number>();
  readonly feed: Feed;
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
    readonly limits: Pick<ServerConfig, "roomLifetimeMs" | "maxSessionsPerRoom" | "feedCapacity">,
    /** Runs with +1 or -1 as a session gets its first socket or loses its last one. */
    readonly onPeopleChange: (delta: number) => void = () => {},
  ) {
    this.#hostToken = hostToken;
    this.race = createRace(settings);
    this.feed = new Feed(limits.feedCapacity);
    this.#lastActivityAt = now;
    this.openedAt = now;
    this.expiresAt = now + limits.roomLifetimeMs;
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
    if (this.#entrantIds.size >= this.limits.maxSessionsPerRoom) {
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
    const open = this.#sessionSockets.get(sessionSecret) ?? 0;
    this.#sessionSockets.set(sessionSecret, open + 1);
    if (open === 0) {
      this.onPeopleChange(1);
    }
  }

  /**
   * Counts a session's socket as closed. A session with no sockets left that never entered gives
   * its id back, so visitors with throwaway cookies can't use up the room's session limit.
   */
  detachSession(sessionSecret: string): void {
    const open = this.#sessionSockets.get(sessionSecret);
    if (open === undefined) {
      return;
    }
    if (open > 1) {
      this.#sessionSockets.set(sessionSecret, open - 1);
      return;
    }

    this.#sessionSockets.delete(sessionSecret);
    this.onPeopleChange(-1);
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

export type RoomRegistryOptions = Pick<
  ServerConfig,
  | "maxRooms"
  | "idleMs"
  | "idleInputMs"
  | "idleWarningMs"
  | "roomLifetimeMs"
  | "closingWarningMs"
  | "unusedRoomMs"
  | "abandonedAfterMs"
  | "abandonedRoomHeadroom"
  | "maxSessionsPerRoom"
  | "feedCapacity"
>;

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
  /** The people online, counted by the rooms as sessions come and go. */
  #people = 0;
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

  /** Counts the people in open rooms, a person in 2 rooms twice. */
  get peopleCount(): number {
    return this.#people;
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
    const room = new Room(slug, hostToken, settings, now, this.options, (delta) => {
      this.#people += delta;
    });
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

  /** Drops the rooms that are over, each with the reason it closed. */
  sweep(now: number): DroppedRoom[] {
    const dropped: DroppedRoom[] = [];
    const drop = (room: Room, reason: CloseReason) => {
      this.#rooms.delete(room.slug);
      this.#people -= room.sessionCount;
      dropped.push({ slug: room.slug, reason });
    };

    for (const room of this.#rooms.values()) {
      const reason = this.#closeReason(room, now);
      if (reason !== null) {
        drop(room, reason);
      }
    }

    const abandoned = [...this.#rooms.values()]
      .filter((room) => this.#isAbandoned(room, now))
      .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    // A queued restart only waits for rooms someone is in, so it doesn't wait on abandoned ones.
    if (this.#restartAt !== null && abandoned.length === this.#rooms.size) {
      for (const room of abandoned) {
        drop(room, "restart");
      }
      return dropped;
    }
    for (const room of abandoned) {
      if (this.#rooms.size <= this.options.maxRooms - this.options.abandonedRoomHeadroom) {
        break;
      }
      drop(room, "empty");
    }

    return dropped;
  }

  #isAbandoned(room: Room, now: number): boolean {
    return room.connected === 0 && now - room.lastActivityAt >= this.options.abandonedAfterMs;
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
