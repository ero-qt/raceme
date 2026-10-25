import type { ServerConfig } from "./server/server.ts";
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
    surgeRoomsPerMinute: count("RACEME_SURGE_ROOMS_PER_MINUTE", 30),
    // About 65,000 hashes, roughly a second in a phone's browser.
    surgeBits: 16,
    countdownMs: 10_000,
    chatEveryMs: count("RACEME_CHAT_SECONDS", 3) * 1000,
    maxSocketsPerIp: count("RACEME_MAX_SOCKETS_PER_IP", 10),
    maxSockets: count("RACEME_MAX_SOCKETS", 8192),
    sweepIntervalMs: 60_000,
  };
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
