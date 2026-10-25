import { describe, expect, test } from "bun:test";
import { ClientLimits } from "./client-limits.ts";

function limits() {
  return new ClientLimits({ maxSocketsPerIp: 10, maxSockets: 100 }, () => 0);
}

describe("ClientLimits.createRoom", () => {
  // One provider handing out many addresses shouldn't open more rooms than a few people would.
  test("limits room creation for a whole network, not just each address", () => {
    const shared = limits();
    const results: boolean[] = [];

    for (let host = 1; host <= 10; host++) {
      for (let i = 0; i < 3; i++) {
        results.push(shared.createRoom(`203.0.113.${host}`));
      }
    }

    expect(results.filter(Boolean)).toHaveLength(20);
    expect(shared.createRoom("198.51.100.1")).toBe(true);
  });
});
