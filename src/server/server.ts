import type { Server } from "bun";
import type { ServerConfig } from "../config.ts";
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
  const rooms = new RoomRegistry(config);
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
    config.speedrunApi === null
      ? null
      : new SpeedrunCatalog({
          apiUrl: config.speedrunApi,
          perMinute: config.speedrunPerMinute,
          clock,
        });
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
      clearAfterEndMs: config.clearAfterEndMs,
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
    for (const { slug, reason } of rooms.sweep(now)) {
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
    config.adminSocket === null
      ? null
      : Bun.serve({
          unix: config.adminSocket,
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
