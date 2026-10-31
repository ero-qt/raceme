import { afterEach, describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { connectRoom } from "./connection.ts";

const RealWebSocket = globalThis.WebSocket;
const realSetTimeout = globalThis.setTimeout;

// Stands in for a socket that is still connecting and never gets through.
class StuckSocket {
  static opened: StuckSocket[] = [];
  readyState = 0;
  url: string;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(url: URL | string) {
    this.url = String(url);
    StuckSocket.opened.push(this);
  }

  send(data: string) {
    if (this.readyState !== 1) {
      throw new DOMException("Still in CONNECTING state.", "InvalidStateError");
    }
    this.sent.push(data);
  }

  close() {}
}

function useStuckSocket() {
  StuckSocket.opened = [];
  globalThis.WebSocket = StuckSocket as never;
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    "http://localhost/abcdefghij",
  );
}

// Collects retries instead of waiting for them, so a test can fire them by hand.
function captureTimers(delays: number[] = []): (() => void)[] {
  const pending: (() => void)[] = [];
  globalThis.setTimeout = ((run: () => void, delay: number) => {
    pending.push(run);
    delays.push(delay);
    return pending.length;
  }) as never;
  return pending;
}

afterEach(() => {
  globalThis.WebSocket = RealWebSocket;
  globalThis.setTimeout = realSetTimeout;
});

describe("connectRoom", () => {
  test("says when an action can't go out instead of throwing or dropping it silently", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");

      expect(() => room.send({ type: "done" })).not.toThrow();
      expect(room.notice()).toBe("not connected. try again in a moment.");

      dispose();
    });
  });

  test("reconnects after a dropped socket", () => {
    useStuckSocket();
    const timers = captureTimers();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      StuckSocket.opened[0]?.onclose?.({ code: 1006 });
      expect(room.notice()).toBe("connection lost. reconnecting…");

      timers.shift()?.();
      expect(StuckSocket.opened).toHaveLength(2);

      dispose();
    });
  });

  test("retries spread out over half to one and a half times the wait, and ask for the lines after the last one shown", () => {
    useStuckSocket();
    const delays: number[] = [];
    const timers = captureTimers(delays);

    createRoot((dispose) => {
      connectRoom("abcdefghij");
      const socket = StuckSocket.opened[0];
      socket?.onmessage?.({
        data: JSON.stringify({ type: "feed", entries: [{ id: 7, kind: "bot", text: "a", at: 0 }] }),
      });
      socket?.onclose?.({ code: 1006 });
      timers.shift()?.();

      expect(delays[0]).toBeGreaterThanOrEqual(500);
      expect(delays[0]).toBeLessThanOrEqual(1_500);
      expect(new URL(StuckSocket.opened[1]?.url ?? "").searchParams.get("since")).toBe("7");
      expect(new URL(StuckSocket.opened[0]?.url ?? "").searchParams.get("since")).toBeNull();

      dispose();
    });
  });

  test("a retry still pending when the page closes opens no socket", () => {
    useStuckSocket();
    const timers = captureTimers();

    createRoot((dispose) => {
      connectRoom("abcdefghij");
      StuckSocket.opened[0]?.onclose?.({ code: 1006 });

      dispose();
      timers.shift()?.();
    });

    expect(StuckSocket.opened).toHaveLength(1);
  });

  test("a room that is gone stops retrying and settles ready", async () => {
    useStuckSocket();
    const timers = captureTimers();

    await createRoot(async (dispose) => {
      const room = connectRoom("abcdefghij");
      StuckSocket.opened[0]?.onclose?.({ code: 4404 });

      await room.ready;
      expect(room.gone()).toBe(true);
      expect(timers).toHaveLength(0);

      dispose();
    });
  });

  test("a refusal stays shown when someone else's action updates the room", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      const socket = StuckSocket.opened[0];
      socket?.onmessage?.({ data: JSON.stringify({ type: "refused", refusal: "tooEarly" }) });
      const refusal = room.notice();

      socket?.onmessage?.({
        data: JSON.stringify({ type: "state", serverNow: 0, race: { phase: "running" } }),
      });

      expect(refusal).not.toBeNull();
      expect(room.notice()).toBe(refusal);

      dispose();
    });
  });

  test("takes the watcher count from each state", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      StuckSocket.opened[0]?.onmessage?.({
        data: JSON.stringify({ type: "state", serverNow: 0, race: { phase: "open" }, watchers: 4 }),
      });

      expect(room.watchers()).toBe(4);
      StuckSocket.opened[0]?.onmessage?.({ data: JSON.stringify({ type: "watchers", count: 5 }) });
      expect(room.watchers()).toBe(5);

      dispose();
    });
  });

  test("keeps an idle warning until someone in the room acts", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      const socket = StuckSocket.opened[0];
      socket?.onmessage?.({
        data: JSON.stringify({ type: "idleWarning", closesAt: 900_000, quietFor: "2 hours" }),
      });
      expect(room.idleClosesAt()).toBe(900_000);

      socket?.onmessage?.({ data: JSON.stringify({ type: "idleCleared" }) });
      expect(room.idleClosesAt()).toBeNull();

      dispose();
    });
  });

  test("keeps the reason a room closed for", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      (StuckSocket.opened[0]?.onclose as unknown as (e: object) => void)?.({
        code: 4404,
        reason: "room closed: time limit reached.",
      });

      expect(room.gone()).toBe(true);
      expect(room.notice()).toBe("room closed: time limit reached.");

      dispose();
    });
  });

  test("keeps the close reason when someone acts after the room closed", () => {
    useStuckSocket();

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      (StuckSocket.opened[0]?.onclose as unknown as (e: object) => void)?.({
        code: 4404,
        reason: "room closed: no activity.",
      });

      room.send({ type: "active" });

      expect(room.notice()).toBe("room closed: no activity.");
      dispose();
    });
  });

  // The server forgets a closed room, so only this tab can show it again after a reload.
  test("shows a closed room again after a reload in the same tab", () => {
    useStuckSocket();
    sessionStorage.clear();
    const race = { phase: "terminated", goal: "any%", entrants: [] };

    createRoot((dispose) => {
      connectRoom("abcdefghij");
      const socket = StuckSocket.opened[0];
      socket?.onmessage?.({
        data: JSON.stringify({ type: "welcome", entrantId: "e1", isHost: true }),
      });
      socket?.onmessage?.({ data: JSON.stringify({ type: "state", serverNow: 5_000, race }) });
      (socket?.onclose as unknown as (e: object) => void)?.({
        code: 4404,
        reason: "room closed: the race ended.",
      });
      dispose();
    });

    createRoot((dispose) => {
      const room = connectRoom("abcdefghij");
      (StuckSocket.opened[1]?.onclose as unknown as (e: object) => void)?.({
        code: 4404,
        reason: "room gone",
      });

      expect(room.race()).toEqual(race as never);
      expect(room.me()).toEqual({ entrantId: "e1", isHost: true });
      expect(room.notice()).toBe("room closed: the race ended.");
      expect(room.closedAt()).not.toBeNull();

      dispose();
    });
    sessionStorage.clear();
  });
});
