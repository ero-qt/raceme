import { timingSafeEqual } from "node:crypto";

// RFC 4648 base32 alphabet in lowercase: 32 symbols, so `byte & 31` picks one without bias.
const slugAlphabet = "abcdefghijklmnopqrstuvwxyz234567";

/** Creates a random room slug of `length` base32 characters, 5 bits of entropy each. */
export function randomSlug(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => slugAlphabet[byte & 31]).join("");
}

/** Creates a random 256-bit secret as base64url text. */
export function randomSecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** Compares 2 secrets in constant time so response timing gives nothing away. */
export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
