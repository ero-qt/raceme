import type { Server } from "bun";
import { ClientLimits } from "./client-limits.ts";
import { withSecurityHeaders } from "./http.ts";
import { RoomHub, botLines } from "./room-hub.ts";
import { type SocketData, roomSocketHandlers } from "./room-socket.ts";
import { type CloseReason, RoomRegistry } from "./rooms.ts";
import { createRouter } from "./routes.ts";
import { SpeedrunCatalog } from "./speedrun.ts";
import { SurgeGuard } from "./surge.ts";

export interface ServerConfig {
  port: number;
  /** Sets the interface to listen on, like `127.0.0.1` behind Caddy. */
  hostname: string;
  /**
   * Marks cookies `Secure`. Only a plain http preview turns this off, because browsers drop
   * `Secure` cookies on http pages other than localhost.
   */
  secureCookies: boolean;
  /** Sets the URL prefix like `/apps/raceme`, with `""` at the root. */
  basePath: string;
  /** Only origin allowed to create rooms and open sockets, `null` to allow any. */
  origin: string | null;
  /** Folder with the built client, `null` when Vite serves it in development. */
  staticDir: string | null;
  /** Reads the client IP from `X-Forwarded-For`, for running behind Caddy. */
  trustProxy: boolean;
  /** Base URL of the speedrun.com API for the game picker, `null` to turn the picker off. */
  speedrunApi: string | null;
  maxRooms: number;
  idleMs: number;
  /** Ends a room after this long without input from anyone, even with tabs open. */
  idleInputMs: number;
  /** Gives an idle room this long between the warning and the end. */
  idleWarningMs: number;
  /** Ends every room this long after it opened. */
  roomLifetimeMs: number;
  /** Warns a room this long before it reaches `roomLifetimeMs`. */
  closingWarningMs: number;
  /** Drops an empty room nobody ever entered after this long. */
  unusedRoomMs: number;
  /** Asks new rooms for a proof of work once more than this many open within a minute. */
  surgeRoomsPerMinute: number;
  /** Sets how hard that proof is, as leading zero bits of a SHA-256. */
  surgeBits: number;
  countdownMs: number;
  /** Lets each entrant send 1 chat line this often. */
  chatEveryMs: number;
  maxSocketsPerIp: number;
  maxSockets: number;
  /** Checks for idle and cleared rooms this often. */
  sweepIntervalMs: number;
  /** Points at the release this server runs, `null` for a build that didn't come from a release. */
  build: BuildInfo | null;
}

/** Points at the commit and the attested release tarball, so visitors can check the build. */
export interface BuildInfo {
  /** Gives the release tag, like `1.2.0`. */
  release: string;
  /** Links to the source on GitHub, which keeps outside hosts out of the page bundle. */
  repository: string;
  commit: string;
  digest: string;
}

export interface RunningServer {
  server: Server<SocketData>;
  rooms: RoomRegistry;
  stop(): void;
}

const maxRequestBytes = 4096;

/** Explains why a room closed, sent as the socket's close reason for the closed page. */
function closeText(reason: CloseReason): string {
  const texts: Record<CloseReason, string> = {
    ended: "Room closed: the race ended.",
    expired: "Room closed: time limit reached.",
    idle: "Room closed: no activity.",
    empty: "Room closed: everyone left.",
  };
  return texts[reason];
}

/** Writes a duration of whole minutes in words for RaceBot, like `2 hours` or `90 minutes`. */
function spokenDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

// Counts from the process start without following wall clock steps, so a time sync during a
// race can't stall the countdown or skew finish times. Whole milliseconds keep fractions out of
// finish times.
export function steadyClock(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}

/** Starts raceme's HTTP and websocket server with every room kept in memory. */
export function startServer(config: ServerConfig, clock = steadyClock): RunningServer {
  const rooms = new RoomRegistry({
    maxRooms: config.maxRooms,
    idleMs: config.idleMs,
    idleInputMs: config.idleInputMs,
    idleWarningMs: config.idleWarningMs,
    roomLifetimeMs: config.roomLifetimeMs,
    closingWarningMs: config.closingWarningMs,
    unusedRoomMs: config.unusedRoomMs,
  });
  const limits = new ClientLimits(config, clock);
  const hub = new RoomHub<SocketData>((slug, message) => server.publish(slug, message), clock);
  const catalog =
    config.speedrunApi === null ? null : new SpeedrunCatalog({ apiUrl: config.speedrunApi, clock });
  const surge = new SurgeGuard({
    roomsPerMinute: config.surgeRoomsPerMinute,
    bits: config.surgeBits,
    clock,
  });
  const route = createRouter({ config, rooms, limits, catalog, surge, clock });

  const server = Bun.serve<SocketData>({
    port: config.port,
    hostname: config.hostname,
    maxRequestBodySize: maxRequestBytes,
    async fetch(request, server) {
      const response = await route(request, server);
      return response && withSecurityHeaders(response);
    },
    websocket: roomSocketHandlers({
      rooms,
      hub,
      limits,
      clock,
      chatEveryMs: config.chatEveryMs,
    }),
  });

  const sweeper = setInterval(() => {
    const now = clock();
    for (const slug of rooms.idleWarnings(now)) {
      const room = rooms.get(slug);
      if (room) {
        hub.warnIdle(room, now + config.idleWarningMs, spokenDuration(config.idleInputMs));
      }
    }
    for (const slug of rooms.closingSoon(now)) {
      const room = rooms.get(slug);
      if (room) {
        const line = `This room closes in ${spokenDuration(config.closingWarningMs)}. Rooms last at most ${spokenDuration(config.roomLifetimeMs)}, so start a new one to keep racing.`;
        hub.publishLines(room, botLines([line], now));
      }
    }
    for (const { slug, reason } of rooms.sweepWithReasons(now)) {
      hub.closeRoom(slug, closeText(reason));
    }
    limits.sweep(now);
  }, config.sweepIntervalMs);

  return {
    server,
    rooms,
    stop() {
      clearInterval(sweeper);
      hub.stop();
      server.stop(true);
    },
  };
}
