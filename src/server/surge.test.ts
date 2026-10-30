import { describe, expect, test } from "bun:test";
import { proofHolds, solveChallenge } from "../shared/proof-of-work.ts";
import { SurgeGuard } from "./surge.ts";

function guard(now: () => number, roomsPerMinute = 3) {
  return new SurgeGuard({ roomsPerMinute, bits: 8, clock: now });
}

describe("SurgeGuard", () => {
  test("asks for no proof while room creation stays normal", () => {
    const surge = guard(() => 0);
    surge.recordRoom();
    surge.recordRoom();

    expect(surge.needsProof()).toBe(false);
  });

  test("asks for proof once more rooms open in a minute than allowed, and stops after", () => {
    let now = 0;
    const surge = guard(() => now);
    for (let i = 0; i < 4; i++) {
      surge.recordRoom();
    }
    expect(surge.needsProof()).toBe(true);

    now = 60_001;
    expect(surge.needsProof()).toBe(false);
  });

  test("accepts a solved challenge once", async () => {
    const surge = guard(() => 0);
    const challenge = surge.issueChallenge();

    const nonce = await solveChallenge(challenge.token, challenge.bits);

    expect(await surge.acceptProof(challenge.token, nonce)).toBe(true);
    expect(await surge.acceptProof(challenge.token, nonce)).toBe(false);
  });

  test("refuses a wrong answer, a changed challenge and an expired one", async () => {
    let now = 0;
    const surge = guard(() => now);
    const challenge = surge.issueChallenge();
    const nonce = await solveChallenge(challenge.token, challenge.bits);

    let wrong = nonce + 1;
    while (await proofHolds(challenge.token, wrong, challenge.bits)) {
      wrong++;
    }

    expect(await surge.acceptProof(challenge.token, wrong)).toBe(false);
    expect(await surge.acceptProof(`${challenge.token}x`, nonce)).toBe(false);

    now = 5 * 60_000 + 1;
    expect(await surge.acceptProof(challenge.token, nonce)).toBe(false);
  });

  // The server clock counts fractions of a millisecond, which must not break the token.
  test("accepts a proof when the clock gives fractional milliseconds", async () => {
    const surge = guard(() => 1_792_923_151_477.6829);
    const challenge = surge.issueChallenge();

    const nonce = await solveChallenge(challenge.token, challenge.bits);

    expect(await surge.acceptProof(challenge.token, nonce)).toBe(true);
  });
});
