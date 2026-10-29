import type { Server } from "bun";
import { SpikeAlerts } from "./alerts.ts";
import { ClientLimits } from "./client-limits.ts";
import { json, status, withSecurityHeaders } from "./http.ts";
import { nextRestartAt } from "./restart.ts";
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
  /** Counts a room as abandoned after this long with nobody connected. */
  abandonedAfterMs: number;
  /** Frees abandoned rooms once fewer than this many rooms are free. */
  abandonedRoomHeadroom: number;
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
  /** Posts to this Discord webhook when rooms or people online climb past a level, `null` for none. */
  alertWebhook: string | null;
  /** Listens on 127.0.0.1 at this port for the deploy script, `null` to leave it off. */
  adminPort: number | null;
  /** Restarts for a new release at this hour in UTC, unless no room is open before then. */
  restartHourUtc: number;
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
  admin: Server<undefined> | null;
  rooms: RoomRegistry;
  stop(): void;
}

const maxRequestBytes = 4096;

/** Explains why a room closed, sent as the socket's close reason for the closed page. */
function closeText(reason: CloseReason): string {
  const texts: Record<CloseReason, string> = {
    ended: "room closed: the race ended.",
    expired: "room closed: time limit reached.",
    idle: "room closed: no activity.",
    empty: "room closed: everyone left.",
    restart: "room closed: the server restarts for an update.",
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
    abandonedAfterMs: config.abandonedAfterMs,
    abandonedRoomHeadroom: config.abandonedRoomHeadroom,
  });
  const webhook = config.alertWebhook;
  const alerts = new SpikeAlerts((content) => {
    if (webhook) {
      // Sends without waiting for the answer, so a slow or failing Discord never delays a room.
      void fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      }).catch(() => {});
    }
  });
  const countsChanged = () => {
    alerts.update("rooms", rooms.size);
    alerts.update("people", rooms.peopleCount);
  };
  const limits = new ClientLimits(config, clock);
  const hub = new RoomHub<SocketData>((slug, message) => server.publish(slug, message), clock);
  const catalog =
    config.speedrunApi === null ? null : new SpeedrunCatalog({ apiUrl: config.speedrunApi, clock });
  const surge = new SurgeGuard({
    roomsPerMinute: config.surgeRoomsPerMinute,
    bits: config.surgeBits,
    clock,
  });
  const route = createRouter({ config, rooms, limits, catalog, surge, clock, countsChanged });

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
      countsChanged,
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
        const left = spokenDuration(config.closingWarningMs);
        if (room.closesFor === "restart") {
          hub.warnRestart(room, room.lastsUntil);
        }
        const line =
          room.closesFor === "restart"
            ? `This room closes in ${left} for a server restart.`
            : `This room closes in ${left}. Rooms last at most ${spokenDuration(config.roomLifetimeMs)}, so start a new one to keep racing.`;
        hub.publishLines(room, botLines([line], now));
      }
    }
    for (const { slug, reason } of rooms.sweepWithReasons(now)) {
      hub.closeRoom(slug, closeText(reason));
      countsChanged();
    }
    limits.sweep(now);
  }, config.sweepIntervalMs);

  const restartTime = `${String(config.restartHourUtc).padStart(2, "0")}:00 UTC`;
  const queueRestart = () => {
    const now = clock();
    rooms.queueRestart(nextRestartAt(now, config.restartHourUtc));
    for (const room of rooms.rooms()) {
      hub.publishState(room);
      hub.publishLines(
        room,
        botLines([`Server restart queued for ${restartTime}. This room closes then.`], now),
      );
    }
  };
  const admin =
    config.adminPort === null
      ? null
      : Bun.serve({
          port: config.adminPort,
          hostname: "127.0.0.1",
          fetch(request) {
            if (new URL(request.url).pathname !== "/restart") {
              return status(404);
            }
            if (request.method === "POST" && rooms.restartAt === null) {
              queueRestart();
            } else if (request.method !== "GET" && request.method !== "POST") {
              return status(405);
            }
            return json({ restartAt: rooms.restartAt, rooms: rooms.size });
          },
        });

  return {
    server,
    admin,
    rooms,
    stop() {
      clearInterval(sweeper);
      hub.stop();
      server.stop(true);
      admin?.stop(true);
    },
  };
}
