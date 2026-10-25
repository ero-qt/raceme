import type { Server } from "bun";
import { ClientLimits } from "./client-limits.ts";
import { withSecurityHeaders } from "./http.ts";
import { RoomHub } from "./room-hub.ts";
import { type SocketData, roomSocketHandlers } from "./room-socket.ts";
import { RoomRegistry } from "./rooms.ts";
import { createRouter } from "./routes.ts";

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
  maxRooms: number;
  idleMs: number;
  countdownMs: number;
  maxSocketsPerIp: number;
  maxSockets: number;
  /** Checks for idle and cleared rooms this often. */
  sweepIntervalMs: number;
}

export interface RunningServer {
  server: Server<SocketData>;
  rooms: RoomRegistry;
  stop(): void;
}

const maxRequestBytes = 4096;

// Counts from the process start without following wall clock steps, so a time sync during a
// race can't stall the countdown or skew finish times.
function steadyClock(): number {
  return performance.timeOrigin + performance.now();
}

/** Starts raceme's HTTP and websocket server with every room kept in memory. */
export function startServer(config: ServerConfig, clock = steadyClock): RunningServer {
  const rooms = new RoomRegistry({ maxRooms: config.maxRooms, idleMs: config.idleMs });
  const limits = new ClientLimits(config, clock);
  const hub = new RoomHub<SocketData>((slug, message) => server.publish(slug, message), clock);
  const route = createRouter({ config, rooms, limits, clock });

  const server = Bun.serve<SocketData>({
    port: config.port,
    hostname: config.hostname,
    maxRequestBodySize: maxRequestBytes,
    async fetch(request, server) {
      const response = await route(request, server);
      return response && withSecurityHeaders(response);
    },
    websocket: roomSocketHandlers({ rooms, hub, limits, clock }),
  });

  const sweeper = setInterval(() => {
    const now = clock();
    for (const slug of rooms.sweep(now)) {
      hub.closeRoom(slug);
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
