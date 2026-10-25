import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import type { ClientAction, ServerMessage } from "../../shared/protocol.ts";
import type { RaceState } from "../../shared/race/race.ts";
import { refusalText } from "./action-labels.ts";

export interface RoomConnection {
  race: Accessor<RaceState | null>;
  me: Accessor<{ entrantId: string; isHost: boolean } | null>;
  /** Adds to `Date.now()` to get the server's clock. */
  clockOffset: Accessor<number>;
  notice: Accessor<string | null>;
  feed: Accessor<FeedEntry[]>;
  /** Turns true once the server closes the socket with the room-gone code. */
  gone: Accessor<boolean>;
  /** Settles once the room has sent its first full picture. A room that is gone settles it too. */
  ready: Promise<void>;
  send: (action: ClientAction) => void;
}

const roomGoneCode = 4404;
const maxRetryMs = 10_000;
const maxFeedEntries = 200;

/** Keeps a websocket to the room open for as long as the calling component lives. */
export function connectRoom(slug: string): RoomConnection {
  const [race, setRace] = createSignal<RaceState | null>(null);
  const [me, setMe] = createSignal<{ entrantId: string; isHost: boolean } | null>(null);
  const [clockOffset, setClockOffset] = createSignal(0);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [feed, setFeed] = createSignal<FeedEntry[]>([]);
  const [gone, setGone] = createSignal(false);
  const { promise: ready, resolve: markReady } = Promise.withResolvers<void>();

  let socket: WebSocket | null = null;
  let retryMs = 1_000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const url = new URL(`api/rooms/${slug}/ws`, new URL(import.meta.env.BASE_URL, location.href));
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";

  function open(): void {
    if (closed) {
      return;
    }

    socket = new WebSocket(url);
    socket.onopen = () => {
      retryMs = 1_000;
      setNotice(null);
    };
    socket.onmessage = (event) => receive(JSON.parse(String(event.data)) as ServerMessage);
    socket.onclose = (event) => {
      if (closed) {
        return;
      }

      if (event.code === roomGoneCode) {
        setNotice(refusalText.roomGone);
        setGone(true);
        markReady();
        return;
      }

      setNotice("Connection lost. Reconnecting…");
      retryTimer = setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, maxRetryMs);
    };
  }

  function receive(message: ServerMessage): void {
    switch (message.type) {
      case "welcome":
        setMe({ entrantId: message.entrantId, isHost: message.isHost });
        break;
      case "state":
        setClockOffset(message.serverNow - Date.now());
        setRace(message.race);
        break;
      case "feed": {
        // A reconnect resends the whole log, so only lines newer than the last one shown count.
        const lastId = feed().at(-1)?.id ?? 0;
        const fresh = message.entries.filter((entry) => entry.id > lastId);
        setFeed([...feed(), ...fresh].slice(-maxFeedEntries));
        // The server sends the welcome, the state and then the feed, so the room is complete here.
        markReady();
        break;
      }
      case "refused":
        setNotice(refusalText[message.refusal]);
        break;
    }
  }

  open();
  onCleanup(() => {
    closed = true;
    clearTimeout(retryTimer);
    socket?.close();
  });

  return {
    race,
    me,
    clockOffset,
    notice,
    feed,
    gone,
    ready,
    send: (action) => {
      if (socket?.readyState !== WebSocket.OPEN) {
        setNotice("Not connected. Try again in a moment.");
        return;
      }

      // A refusal answers the viewer's own last action, so it stays up until their next one.
      setNotice(null);
      socket.send(JSON.stringify(action));
    },
  };
}
