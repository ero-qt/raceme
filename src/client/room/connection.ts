import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import type { ClientAction, ClosesFor, Me, ServerMessage } from "../../shared/protocol.ts";
import type { RaceState } from "../../shared/race/race.ts";
import { refusalText } from "./action-labels.ts";

export interface RoomConnection {
  race: Accessor<RaceState | null>;
  me: Accessor<Me | null>;
  /** Adds to `Date.now()` to get the server's clock. */
  clockOffset: Accessor<number>;
  notice: Accessor<string | null>;
  feed: Accessor<FeedEntry[]>;
  /** Gives when the room closes as idle, while the server warns about it. */
  idleClosesAt: Accessor<number | null>;
  /** Gives how long the server makes each entrant wait between chat lines. */
  chatEveryMs: Accessor<number>;
  /** Counts the people with the room open who haven't entered, from the latest state. */
  watchers: Accessor<number>;
  closesFor: Accessor<ClosesFor>;
  /** Gives when a server restart closes the room, once it is less than an hour away. */
  restartClosesAt: Accessor<number | null>;
  /** Gives the server time the room closes, from the latest state. */
  closesAt: Accessor<number | null>;
  /** Turns true once the server closes the socket with the room-gone code. */
  gone: Accessor<boolean>;
  /** Gives the server time the room closed at, once it's gone. */
  closedAt: Accessor<number | null>;
  /** Settles once the room has sent its first full picture. A room that is gone settles it too. */
  ready: Promise<void>;
  send: (action: ClientAction) => void;
}

const roomGoneCode = 4404;
const maxRetryMs = 10_000;
const maxFeedEntries = 200;

interface ClosedRoom {
  race: RaceState;
  me: Me;
  notice: string;
  closedAt: number;
}

function closedRoomKey(slug: string): string {
  return `raceme.closedRoom.${slug}`;
}

function loadClosedRoom(slug: string): ClosedRoom | null {
  try {
    return JSON.parse(sessionStorage.getItem(closedRoomKey(slug)) ?? "null") as ClosedRoom | null;
  } catch {
    return null;
  }
}

function saveClosedRoom(slug: string, room: ClosedRoom): void {
  try {
    sessionStorage.setItem(closedRoomKey(slug), JSON.stringify(room));
  } catch {
    // Private windows may refuse storage. A reload then shows the generic closed page.
  }
}

/** Keeps a websocket to the room open for as long as the calling component lives. */
export function connectRoom(slug: string): RoomConnection {
  const [race, setRace] = createSignal<RaceState | null>(null);
  const [me, setMe] = createSignal<Me | null>(null);
  const [clockOffset, setClockOffset] = createSignal(0);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [feed, setFeed] = createSignal<FeedEntry[]>([]);
  const [chatEveryMs, setChatEveryMs] = createSignal(0);
  const [closesAt, setClosesAt] = createSignal<number | null>(null);
  const [watchers, setWatchers] = createSignal(0);
  const [closesFor, setClosesFor] = createSignal<ClosesFor>("lifetime");
  const [restartClosesAt, setRestartClosesAt] = createSignal<number | null>(null);
  const [gone, setGone] = createSignal(false);
  const [closedAt, setClosedAt] = createSignal<number | null>(null);
  const [idleClosesAt, setIdleClosesAt] = createSignal<number | null>(null);
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
        closeRoom(event.reason);
        return;
      }

      setNotice("connection lost. reconnecting…");
      retryTimer = setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, maxRetryMs);
    };
  }

  /** Shows the room as closed and keeps it for this tab. An earlier load's copy fills in after a reload. */
  function closeRoom(reason: string | undefined): void {
    const saved = loadClosedRoom(slug);
    const notice = reason?.startsWith("room closed:") ? reason : refusalText.roomGone;
    const currentRace = race();
    const currentMe = me();
    if (currentRace && currentMe) {
      const snapshot: ClosedRoom = {
        race: currentRace,
        me: currentMe,
        notice,
        closedAt: Date.now() + clockOffset(),
      };
      saveClosedRoom(slug, snapshot);
      showClosed(snapshot);
    } else if (saved) {
      showClosed(saved);
    } else {
      setNotice(notice);
    }

    setGone(true);
    markReady();
  }

  function showClosed(snapshot: ClosedRoom): void {
    setRace(snapshot.race);
    setMe(snapshot.me);
    setNotice(snapshot.notice);
    setClosedAt(snapshot.closedAt);
  }

  function receive(message: ServerMessage): void {
    switch (message.type) {
      case "welcome":
        setMe({ entrantId: message.entrantId, isHost: message.isHost });
        setChatEveryMs(message.chatEveryMs);
        break;
      case "state":
        setClockOffset(message.serverNow - Date.now());
        setRace(message.race);
        setClosesAt(message.closesAt);
        setWatchers(message.watchers);
        setClosesFor(message.closesFor);
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
      case "idleWarning":
        setIdleClosesAt(message.closesAt);
        break;
      case "restartWarning":
        setRestartClosesAt(message.closesAt);
        break;
      case "idleCleared":
        setIdleClosesAt(null);
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
    chatEveryMs,
    closesAt,
    watchers,
    closesFor,
    restartClosesAt,
    gone,
    closedAt,
    idleClosesAt,
    ready,
    send: (action) => {
      // Sends nothing once the room is closed so the close reason stays on screen.
      if (gone()) {
        return;
      }
      if (socket?.readyState !== WebSocket.OPEN) {
        setNotice("not connected. try again in a moment.");
        return;
      }

      // A refusal answers the viewer's own last action, so it stays up until their next one.
      setNotice(null);
      socket.send(JSON.stringify(action));
    },
  };
}
