import { describe, expect, test } from "bun:test";
import { networkKey, rateLimitKey } from "./http.ts";

describe("rateLimitKey", () => {
  test("keeps IPv4 addresses as they are", () => {
    expect(rateLimitKey("203.0.113.7")).toBe("203.0.113.7");
  });

  test("unwraps IPv4 addresses mapped into IPv6", () => {
    expect(rateLimitKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  // Providers usually give one IPv6 customer a whole /64, so per-address limits are easy to dodge.
  test("groups IPv6 addresses by their /64 prefix", () => {
    expect(rateLimitKey("2001:db8:1:2::1")).toBe(rateLimitKey("2001:db8:1:2:ffff:ffff:ffff:ffff"));
    expect(rateLimitKey("2001:db8:1:2::1")).not.toBe(rateLimitKey("2001:db8:1:3::1"));
    expect(rateLimitKey("2001:DB8:0001:0002::1")).toBe("2001:db8:1:2::/64");
  });
});

describe("networkKey", () => {
  test("groups IPv4 addresses by /24 and IPv6 prefixes by /48", () => {
    expect(networkKey("203.0.113.7")).toBe("203.0.113.0/24");
    expect(networkKey("2001:db8:1:2::/64")).toBe("2001:db8:1::/48");
  });
});
