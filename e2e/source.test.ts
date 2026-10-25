import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Glob } from "bun";

const dist = join(import.meta.dir, "..", "dist", "client");
const scripts = await Promise.all(
  Array.from(new Glob("assets/*.js").scanSync(dist), (path) => Bun.file(join(dist, path)).text()),
);
const bundle = scripts.join("\n");

describe("built page", () => {
  // Discord and other chats read these for the link card, the same for every page.
  test("gives link previews a generic card and keeps search engines out", async () => {
    const html = await Bun.file(join(dist, "index.html")).text();

    expect(html).toContain('<meta property="og:title" content="raceme" />');
    expect(html).toContain('<meta name="description" content="SRL-style speedrun race rooms." />');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  test("names no outside host, apart from XML namespace ids that are never fetched", () => {
    const hosts = new Set(Array.from(bundle.matchAll(/https?:\/\/([a-z0-9.-]+)/gi), (m) => m[1]));

    expect([...hosts].filter((host) => host !== "www.w3.org")).toEqual([]);
  });

  test("uses no tracking or beacon APIs", () => {
    for (const api of [
      "sendBeacon",
      "gtag(",
      "analytics",
      "fingerprint",
      "navigator.geolocation",
    ]) {
      expect(bundle.includes(api)).toBe(false);
    }
  });
});
