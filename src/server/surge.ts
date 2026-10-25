import { createHmac, timingSafeEqual } from "node:crypto";
import { proofHolds } from "../shared/proof-of-work.ts";
import { randomSecret } from "./tokens.ts";

const windowMs = 60_000;
const challengeLifetimeMs = 5 * 60_000;

export interface SurgeOptions {
  /** Asks for proof once more rooms than this open within a minute. */
  roomsPerMinute: number;
  /** Sets how many leading zero bits a proof needs, about 2^bits hashes of work. */
  bits: number;
  secret?: string;
  clock: () => number;
}

export interface Challenge {
  token: string;
  bits: number;
}

/**
 * Notices when rooms open faster than people would open them, even spread over many addresses,
 * and then asks every new room for a small proof of work. Normal visitors never see it, while a
 * script opening hundreds of rooms pays for each one with CPU time.
 */
export class SurgeGuard {
  readonly #openedAt: number[] = [];
  // Keys are solved challenge tokens and values their expiry, so each proof works once.
  readonly #used = new Map<string, number>();
  readonly #options: SurgeOptions;
  readonly #secret: string;

  constructor(options: SurgeOptions) {
    this.#options = options;
    this.#secret = options.secret ?? randomSecret();
  }

  recordRoom(): void {
    this.#openedAt.push(this.#options.clock());
  }

  needsProof(): boolean {
    const since = this.#options.clock() - windowMs;
    while (this.#openedAt.length > 0 && (this.#openedAt[0] ?? 0) <= since) {
      this.#openedAt.shift();
    }

    return this.#openedAt.length > this.#options.roomsPerMinute;
  }

  /** Hands out a challenge signed by the server, so the server doesn't have to remember it. */
  issueChallenge(): Challenge {
    const expiresAt = Math.floor(this.#options.clock() + challengeLifetimeMs);
    const body = `${randomSecret()}.${expiresAt}`;
    return { token: `${body}.${this.#sign(body)}`, bits: this.#options.bits };
  }

  async acceptProof(token: string, nonce: number): Promise<boolean> {
    const now = this.#options.clock();
    this.#forgetExpired(now);

    const [salt, expiry, signature] = token.split(".");
    const expiresAt = Number(expiry);
    if (!salt || !signature || !Number.isFinite(expiresAt) || expiresAt < now) {
      return false;
    }
    if (!this.#signatureMatches(`${salt}.${expiry}`, signature) || this.#used.has(token)) {
      return false;
    }
    if (!Number.isSafeInteger(nonce) || !(await proofHolds(token, nonce, this.#options.bits))) {
      return false;
    }

    this.#used.set(token, expiresAt);
    return true;
  }

  #sign(body: string): string {
    return createHmac("sha256", this.#secret).update(body).digest("base64url");
  }

  #signatureMatches(body: string, signature: string): boolean {
    const expected = Buffer.from(this.#sign(body));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  #forgetExpired(now: number): void {
    for (const [token, expiresAt] of this.#used) {
      if (expiresAt < now) {
        this.#used.delete(token);
      }
    }
  }
}
