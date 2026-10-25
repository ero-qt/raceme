import { readFileSync } from "node:fs";
import type { BuildInfo, ServerConfig } from "./server/server.ts";
import { normalizeBasePath } from "./shared/base-path.ts";

type Env = Record<string, string | undefined>;

/** Reads the server settings from environment variables, see the configuration table in readme.md. */
export function loadConfig(env: Env): ServerConfig {
  const count = (name: string, fallback: number) => positiveInteger(env, name, fallback);

  return {
    port: count("PORT", 8790),
    hostname: env.RACEME_HOST ?? "127.0.0.1",
    secureCookies: env.RACEME_INSECURE_COOKIES !== "1",
    basePath: normalizeBasePath(env.RACEME_BASE_PATH ?? ""),
    origin: env.RACEME_ORIGIN ?? null,
    staticDir: env.RACEME_STATIC_DIR ?? null,
    trustProxy: env.RACEME_TRUST_PROXY === "1",
    speedrunApi: speedrunApi(env.RACEME_SPEEDRUN_API),
    maxRooms: count("RACEME_MAX_ROOMS", 2048),
    idleMs: count("RACEME_IDLE_MINUTES", 120) * 60_000,
    idleInputMs: count("RACEME_IDLE_INPUT_MINUTES", 120) * 60_000,
    idleWarningMs: count("RACEME_IDLE_WARNING_MINUTES", 10) * 60_000,
    roomLifetimeMs: count("RACEME_ROOM_HOURS", 48) * 60 * 60_000,
    closingWarningMs: 60 * 60_000,
    unusedRoomMs: 10 * 60_000,
    surgeRoomsPerMinute: count("RACEME_SURGE_ROOMS_PER_MINUTE", 30),
    // About 65,000 hashes, roughly a second in a phone's browser.
    surgeBits: 16,
    countdownMs: 10_000,
    chatEveryMs: count("RACEME_CHAT_SECONDS", 3) * 1000,
    maxSocketsPerIp: count("RACEME_MAX_SOCKETS_PER_IP", 10),
    maxSockets: count("RACEME_MAX_SOCKETS", 8192),
    sweepIntervalMs: 60_000,
    alertWebhook: env.RACEME_ALERT_WEBHOOK_FILE
      ? readSecret(env.RACEME_ALERT_WEBHOOK_FILE, "RACEME_ALERT_WEBHOOK_FILE")
      : null,
    adminPort: env.RACEME_ADMIN_PORT ? count("RACEME_ADMIN_PORT", 0) : null,
    restartHourUtc: hourUtc(env.RACEME_RESTART_HOUR_UTC),
    build: env.RACEME_BUILD_FILE ? readBuildFile(env.RACEME_BUILD_FILE) : null,
  };
}

/** Reads the release, repository, commit and digest the deploy script writes next to each release. */
function readBuildFile(path: string): BuildInfo {
  let parsed: Partial<BuildInfo>;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BuildInfo>;
  } catch (error) {
    throw new Error(`RACEME_BUILD_FILE can't be read as JSON at '${path}': ${error}`);
  }

  const { release, repository, commit, digest } = parsed;
  if (
    !/^\d+\.\d+\.\d+$/.test(release ?? "") ||
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repository ?? "") ||
    !/^[0-9a-f]{40}$/.test(commit ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(digest ?? "")
  ) {
    throw new Error(
      `RACEME_BUILD_FILE needs a release, a GitHub repository, a full commit and a sha256 digest, got '${path}'.`,
    );
  }
  return { release, repository, commit, digest } as BuildInfo;
}

// A typo like `5oo` would turn into NaN, and every comparison with NaN is false, so the limit
// would quietly stop working. Failing at startup names the setting instead.
function positiveInteger(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < 1) {
    throw new Error(`${name} must be a whole number above 0, got '${raw}'.`);
  }
  return value;
}

function readSecret(path: string, name: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    throw new Error(`${name} can't be read at '${path}': ${error}`);
  }
}

function hourUtc(raw: string | undefined): number {
  if (raw === undefined) {
    return 10;
  }

  const hour = Number(raw);
  if (!/^\d+$/.test(raw) || hour > 23) {
    throw new Error(`RACEME_RESTART_HOUR_UTC must be an hour from 0 to 23, got '${raw}'.`);
  }
  return hour;
}

const defaultSpeedrunApi = "https://www.speedrun.com/api";

function speedrunApi(raw: string | undefined): string | null {
  if (raw === "off") {
    return null;
  }

  return (raw || defaultSpeedrunApi).replace(/\/+$/, "");
}

const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);

/** Lists settings that look wrong for running behind a reverse proxy. */
export function configWarnings(
  config: Pick<ServerConfig, "origin" | "trustProxy" | "hostname">,
): string[] {
  const warnings: string[] = [];

  if (config.origin === null) {
    warnings.push("RACEME_ORIGIN is not set, so any website can open rooms and sockets here.");
  }
  if (!config.trustProxy && loopbackHosts.has(config.hostname)) {
    warnings.push(
      "RACEME_TRUST_PROXY is off, so behind a proxy all visitors share one set of rate limits.",
    );
  }

  return warnings;
}
