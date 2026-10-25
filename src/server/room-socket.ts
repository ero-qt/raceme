import type { ServerWebSocket, WebSocketHandler } from "bun";
import { type ServerMessage, parseClientAction } from "../shared/protocol.ts";
import type { ClientLimits } from "./client-limits.ts";
import type { TokenBucket } from "./rate-limit.ts";
import { type RoomActionResult, type Session, chatLine, handleAction } from "./room-actions.ts";
import { type RoomHub, botLines, roomGoneCode } from "./room-hub.ts";
import type { Room, RoomRegistry } from "./rooms.ts";

export interface SocketData extends Session {
  slug: string;
  ip: string;
  sessionSecret: string;
  bucket: TokenBucket;
}

type Socket = ServerWebSocket<SocketData>;

// RaceBot: "Race terminated. The channel will be cleared in 10 minutes!"
const clearAfterEndMs = 10 * 60_000;

function send(socket: Socket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

/** Builds the websocket handlers that connect sockets to their room. */
export function roomSocketHandlers(deps: {
  rooms: RoomRegistry;
  hub: RoomHub<SocketData>;
  limits: ClientLimits;
  clock: () => number;
}): WebSocketHandler<SocketData> {
  const { rooms, hub, limits, clock } = deps;

  function open(socket: Socket): void {
    limits.socketOpened(socket.data.ip);
    const room = rooms.get(socket.data.slug);
    if (!room) {
      socket.close(roomGoneCode, "room gone");
      return;
    }

    hub.join(room, socket);
    room.connect(clock());
    room.attachSession(socket.data.sessionSecret);

    send(socket, { type: "welcome", entrantId: socket.data.entrantId, isHost: socket.data.isHost });
    send(socket, { type: "state", race: room.race, serverNow: clock() });
    send(socket, { type: "feed", entries: [...room.feed.entries] });

    // Someone opening the room is someone at the screen, so it counts as input too.
    if (room.noteInput(clock())) {
      hub.clearIdle(room);
    }
  }

  function close(socket: Socket): void {
    limits.socketClosed(socket.data.ip);
    if (hub.leave(socket.data.slug, socket)) {
      const room = rooms.get(socket.data.slug);
      room?.disconnect(clock());
      room?.detachSession(socket.data.sessionSecret);
    }
  }

  function message(socket: Socket, raw: string | Buffer): void {
    const now = clock();
    const ipAllowed = limits.sendMessage(socket.data.ip);
    if (!socket.data.bucket.take(now) || !ipAllowed) {
      send(socket, { type: "refused", refusal: "rateLimited" });
      return;
    }

    const action = parseClientAction(String(raw));
    if (!action) {
      send(socket, { type: "refused", refusal: "badMessage" });
      return;
    }

    const room = rooms.get(socket.data.slug);
    if (!room) {
      send(socket, { type: "refused", refusal: "roomGone" });
      return;
    }
    room.touch(now);
    if (room.noteInput(now)) {
      hub.clearIdle(room);
    }
    if (action.type === "active") {
      return;
    }

    if (action.type === "say") {
      const line = chatLine(room, socket.data, action.text, now);
      if (typeof line === "string") {
        send(socket, { type: "refused", refusal: line });
      } else {
        hub.publishLines(room, [line]);
      }
      return;
    }

    const result = handleAction(room, socket.data, action, now);
    if (!result.ok) {
      send(socket, { type: "refused", refusal: result.refusal });
      return;
    }
    applyResult(room, result, now);
  }

  /** Stores an accepted action's race state and tells everyone in the room about it. */
  function applyResult(room: Room, result: RoomActionResult & { ok: true }, now: number): void {
    const wasTerminated = room.race.phase === "terminated";
    room.race = result.state;
    if (room.race.phase !== "terminated") {
      room.clearAt = null;
    } else if (!wasTerminated) {
      room.clearAt = now + clearAfterEndMs;
    }

    hub.publishState(room);
    hub.publishLines(room, botLines(result.lines, now));
    hub.scheduleCountdown(room);
  }

  return {
    maxPayloadLength: 2048,
    perMessageDeflate: true,
    // Drops clients that stop answering pings because dead sockets would keep using a slot.
    idleTimeout: 60,
    sendPings: true,
    open,
    close,
    message,
  };
}
