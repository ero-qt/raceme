import { TokenBucket } from "./rate-limit.ts";

interface BucketShape {
  capacity: number;
  perSecond: number;
}

const roomCreation: BucketShape = { capacity: 5, perSecond: 0.1 };
// Room checks and room sockets share this one, since both reveal whether a code is live.
const roomLookup: BucketShape = { capacity: 30, perSecond: 0.5 };
const messages: BucketShape = { capacity: 30, perSecond: 10 };
// Well under the server-wide budget for speedrun.com, so a few visitors can't use it all up.
const gameLookup: BucketShape = { capacity: 20, perSecond: 0.2 };

/** Keeps the per-IP rate limits and open-socket counts that protect the server from abuse. */
export class ClientLimits {
  readonly #creations = new Map<string, TokenBucket>();
  readonly #lookups = new Map<string, TokenBucket>();
  readonly #messages = new Map<string, TokenBucket>();
  readonly #gameLookups = new Map<string, TokenBucket>();
  readonly #socketsPerIp = new Map<string, number>();
  #openSockets = 0;

  constructor(
    readonly options: { maxSocketsPerIp: number; maxSockets: number },
    readonly clock: () => number,
  ) {}

  createRoom(ip: string): boolean {
    return this.#take(this.#creations, ip, roomCreation);
  }

  lookUpRoom(ip: string): boolean {
    return this.#take(this.#lookups, ip, roomLookup);
  }

  lookUpGame(ip: string): boolean {
    return this.#take(this.#gameLookups, ip, gameLookup);
  }

  sendMessage(ip: string): boolean {
    return this.#take(this.#messages, ip, messages);
  }

  hasSocketCapacity(ip: string): boolean {
    const forIp = this.#socketsPerIp.get(ip) ?? 0;
    return forIp < this.options.maxSocketsPerIp && this.#openSockets < this.options.maxSockets;
  }

  socketOpened(ip: string): void {
    this.#openSockets++;
    this.#socketsPerIp.set(ip, (this.#socketsPerIp.get(ip) ?? 0) + 1);
  }

  socketClosed(ip: string): void {
    this.#openSockets--;
    const left = (this.#socketsPerIp.get(ip) ?? 1) - 1;
    if (left > 0) {
      this.#socketsPerIp.set(ip, left);
    } else {
      this.#socketsPerIp.delete(ip);
    }
  }

  /** Forgets IPs whose buckets refilled, so the maps only keep recently active clients. */
  sweep(now: number): void {
    for (const buckets of [this.#creations, this.#lookups, this.#messages, this.#gameLookups]) {
      for (const [ip, bucket] of buckets) {
        if (bucket.isFull(now)) {
          buckets.delete(ip);
        }
      }
    }
  }

  #take(buckets: Map<string, TokenBucket>, ip: string, shape: BucketShape): boolean {
    const now = this.clock();
    const bucket = buckets.get(ip) ?? new TokenBucket(shape.capacity, shape.perSecond, now);
    buckets.set(ip, bucket);
    return bucket.take(now);
  }
}
