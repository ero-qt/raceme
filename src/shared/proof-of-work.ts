/**
 * Checks a proof of work: the SHA-256 of `token:nonce` has to start with `bits` zero bits. Finding
 * a nonce takes about 2^bits hashes, while checking one takes a single hash.
 */
export async function proofHolds(token: string, nonce: number, bits: number): Promise<boolean> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}:${nonce}`)),
  );
  return leadingZeroBits(digest) >= bits;
}

// Hashing in batches with a pause between them keeps the page drawing and answering clicks.
const batchSize = 1024;

/** Finds the first nonce that passes `proofHolds` for `token`. */
export async function solveChallenge(token: string, bits: number): Promise<number> {
  for (let start = 0; ; start += batchSize) {
    const nonces = Array.from({ length: batchSize }, (_, i) => start + i);
    const passes = await Promise.all(nonces.map((nonce) => proofHolds(token, nonce, bits)));
    const found = passes.indexOf(true);
    if (found !== -1) {
      return start + found;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function leadingZeroBits(bytes: Uint8Array): number {
  let count = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      count += 8;
      continue;
    }

    return count + Math.clz32(byte) - 24;
  }
  return count;
}
