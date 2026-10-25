import { describe, expect, test } from "bun:test";
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
});
