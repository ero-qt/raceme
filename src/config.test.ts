import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configWarnings, loadConfig } from "./config.ts";

describe("configWarnings", () => {
  test("warns when origin checks are off", () => {
    expect(configWarnings({ origin: null, trustProxy: true, hostname: "127.0.0.1" })).toEqual([
      "RACEME_ORIGIN is not set, so any website can open rooms and sockets here.",
    ]);
  });

  // Behind Caddy every request comes from 127.0.0.1, so without proxy trust everyone shares limits.
  test("warns when a loopback server ignores the forwarded client address", () => {
    expect(
      configWarnings({ origin: "https://ero-qt.eu", trustProxy: false, hostname: "127.0.0.1" }),
    ).toEqual([
      "RACEME_TRUST_PROXY is off, so behind a proxy all visitors share one set of rate limits.",
    ]);
  });

  test("stays quiet for a proper proxy setup", () => {
    expect(
      configWarnings({ origin: "https://ero-qt.eu", trustProxy: true, hostname: "127.0.0.1" }),
    ).toEqual([]);
  });
});

describe("loadConfig", () => {
  test("defaults to a safe local server", () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      port: 8790,
      hostname: "127.0.0.1",
      secureCookies: true,
      basePath: "",
      origin: null,
      trustProxy: false,
    });
  });

  test("reads the settings from the environment", () => {
    const config = loadConfig({
      PORT: "9000",
      RACEME_BASE_PATH: "apps/raceme",
      RACEME_ORIGIN: "https://ero-qt.eu",
      RACEME_TRUST_PROXY: "1",
      RACEME_IDLE_MINUTES: "60",
    });

    expect(config).toMatchObject({
      port: 9000,
      basePath: "/apps/raceme",
      origin: "https://ero-qt.eu",
      trustProxy: true,
      idleMs: 3_600_000,
    });
  });

  test("refuses a setting that isn't a whole number, so no limit turns off silently", () => {
    for (const env of [
      { RACEME_MAX_ROOMS: "5oo" },
      { RACEME_IDLE_MINUTES: "6h" },
      { RACEME_MAX_SOCKETS_PER_IP: "0" },
      { PORT: "" },
    ]) {
      expect(() => loadConfig(env)).toThrow(Object.keys(env)[0]);
    }
  });

  test("asks speedrun.com for the game picker unless it's turned off", () => {
    expect(loadConfig({}).speedrunApi).toBe("https://www.speedrun.com/api");
    expect(loadConfig({ RACEME_SPEEDRUN_API: "http://127.0.0.1:9000/api/" }).speedrunApi).toBe(
      "http://127.0.0.1:9000/api",
    );
    expect(loadConfig({ RACEME_SPEEDRUN_API: "off" }).speedrunApi).toBeNull();
    expect(loadConfig({ RACEME_SPEEDRUN_API: "" }).speedrunApi).toBe(
      "https://www.speedrun.com/api",
    );
  });

  test("reads how long a room may go without input", () => {
    expect(loadConfig({}).idleInputMs).toBe(2 * 60 * 60_000);
    expect(loadConfig({ RACEME_IDLE_INPUT_MINUTES: "2" }).idleInputMs).toBe(2 * 60_000);
  });

  test("reads how long a room may live", () => {
    expect(loadConfig({}).roomLifetimeMs).toBe(48 * 60 * 60_000);
    expect(loadConfig({ RACEME_ROOM_HOURS: "72" }).roomLifetimeMs).toBe(72 * 60 * 60_000);
  });

  test("reads when a rush of new rooms starts asking for proof of work", () => {
    expect(loadConfig({}).surgeRoomsPerMinute).toBe(30);
    expect(loadConfig({ RACEME_SURGE_ROOMS_PER_MINUTE: "60" }).surgeRoomsPerMinute).toBe(60);
  });

  test("allows 2048 rooms and 8192 sockets unless told otherwise", () => {
    expect(loadConfig({})).toMatchObject({ maxRooms: 2048, maxSockets: 8192 });
  });

  test("drops a room nobody is connected to after 2 hours unless told otherwise", () => {
    expect(loadConfig({}).idleMs).toBe(2 * 60 * 60_000);
  });

  test("reads how long the idle warning lasts", () => {
    expect(loadConfig({}).idleWarningMs).toBe(10 * 60_000);
    expect(loadConfig({ RACEME_IDLE_WARNING_MINUTES: "15" }).idleWarningMs).toBe(15 * 60_000);
  });

  test("reads how long each entrant waits between chat lines", () => {
    expect(loadConfig({}).chatEveryMs).toBe(3_000);
    expect(loadConfig({ RACEME_CHAT_SECONDS: "5" }).chatEveryMs).toBe(5_000);
  });
});

describe("loadConfig build file", () => {
  const dir = mkdtempSync(join(tmpdir(), "raceme-build-"));
  const write = (name: string, body: unknown) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(body));
    return path;
  };

  test("reads the release, repository, commit and digest the deploy wrote", () => {
    const build = {
      release: "1.2.0",
      repository: "https://github.com/ero-qt/raceme",
      commit: "a".repeat(40),
      digest: `sha256:${"b".repeat(64)}`,
    };

    expect(loadConfig({ RACEME_BUILD_FILE: write("good.json", build) }).build).toEqual(build);
    expect(loadConfig({}).build).toBeNull();
  });

  test("refuses a build file without a release, GitHub repository, full commit and digest", () => {
    const repository = "https://github.com/ero-qt/raceme";
    const release = "1.2.0";
    for (const body of [
      { repository, commit: "a".repeat(40), digest: `sha256:${"b".repeat(64)}` },
      { release: "v1.2.0", repository, commit: "a".repeat(40), digest: `sha256:${"b".repeat(64)}` },
      { release, repository, commit: "abc1234", digest: `sha256:${"b".repeat(64)}` },
      { release, repository, commit: "a".repeat(40), digest: "b".repeat(64) },
      { release, repository, commit: "a".repeat(40) },
      {
        release,
        repository: "https://evil.test/x",
        commit: "a".repeat(40),
        digest: `sha256:${"b".repeat(64)}`,
      },
    ]) {
      expect(() => loadConfig({ RACEME_BUILD_FILE: write("bad.json", body) })).toThrow(
        "RACEME_BUILD_FILE",
      );
    }
  });

  test("names the setting when the build file is missing or isn't JSON", () => {
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{");

    expect(() => loadConfig({ RACEME_BUILD_FILE: broken })).toThrow("RACEME_BUILD_FILE");
    expect(() => loadConfig({ RACEME_BUILD_FILE: join(dir, "missing.json") })).toThrow(
      "RACEME_BUILD_FILE",
    );
  });
});
