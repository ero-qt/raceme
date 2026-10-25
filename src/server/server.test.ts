import { afterEach, describe, expect, test } from "bun:test";
import type { ServerMessage } from "../shared/protocol.ts";
import { type RunningServer, type ServerConfig, startServer } from "./server.ts";

const origin = "http://localhost";
let running: RunningServer | undefined;
// Tests move the server's clock forward through this instead of waiting in real time.
let clockOffsetMs = 0;

afterEach(() => {
  running?.stop();
  clockOffsetMs = 0;
});

function start(overrides: Partial<ServerConfig> = {}) {
  running = startServer(
    {
      port: 0,
      hostname: "127.0.0.1",
      secureCookies: true,
      basePath: "/apps/raceme",
      origin,
      staticDir: null,
      trustProxy: false,
      speedrunApi: null,
      maxRooms: 10,
      idleMs: 60_000,
      countdownMs: 50,
      maxSocketsPerIp: 10,
      maxSockets: 2000,
      sweepIntervalMs: 20,
      ...overrides,
    },
    () => Date.now() + clockOffsetMs,
  );
  return `http://127.0.0.1:${running.server.port}/apps/raceme`;
}

function cookieValue(response: Response, prefix: string): string {
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith(prefix));
  if (!cookie) {
    throw new Error(`missing cookie '${prefix}'`);
  }
  return cookie.split(";")[0] ?? "";
}

async function createRoom(base: string, goal = "any%") {
  const response = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  const { slug } = (await response.json()) as { slug: string };
  return { response, slug, host: cookieValue(response, "raceme_host_") };
}

class Client {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;
  readonly opened: Promise<void>;
  readonly closed: Promise<number>;

  constructor(url: string, cookie: string) {
    this.socket = new WebSocket(url, { headers: { origin, cookie } } as never);
    this.socket.onmessage = (event) => this.messages.push(JSON.parse(String(event.data)));
    this.opened = new Promise((resolve) => {
      this.socket.onopen = () => resolve();
    });
    this.closed = new Promise((resolve) => {
      this.socket.onclose = (event) => resolve(event.code);
    });
  }

  send(action: object) {
    this.socket.send(JSON.stringify(action));
  }

  async waitFor(match: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    for (let i = 0; i < 100; i++) {
      const found = this.messages.find(match);
      if (found) {
        return found;
      }
      await Bun.sleep(10);
    }
    throw new Error(`no matching message in ${JSON.stringify(this.messages)}`);
  }
}

const isPhase = (phase: string) => (m: ServerMessage) =>
  m.type === "state" && m.race.phase === phase;

function socketUrl(base: string, slug: string): string {
  return `${base.replace("http", "ws")}/api/rooms/${slug}/ws`;
}

function upgrade(base: string, slug: string, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/rooms/${slug}/ws`, {
    headers: { origin, upgrade: "websocket", connection: "upgrade", ...headers },
  });
}

describe("server", () => {
  test("creating a room sets a host cookie scoped to the base path", async () => {
    const base = start();

    const { response, slug } = await createRoom(base);

    expect(response.status).toBe(201);
    expect(slug).toMatch(/^[a-z2-7]{10}$/);

    const cookie = response.headers.getSetCookie().find((c) => c.startsWith("raceme_host_"));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/apps/raceme");
    // A host who comes back to a long race keeps host rights, so this matches the session cookie.
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  test("marks cookies Secure unless an http-only preview turns that off", async () => {
    const secure = await createRoom(start());
    expect(secure.response.headers.getSetCookie()[0]).toContain("Secure");

    running?.stop();
    const preview = await createRoom(start({ secureCookies: false }));
    expect(preview.response.headers.getSetCookie()[0]).not.toContain("Secure");
  });

  test("listens only on the configured host", () => {
    start();

    expect(running?.server.hostname).toBe("127.0.0.1");
  });

  test("opens the room with the goal already set", async () => {
    const base = start();
    const { slug } = await createRoom(base, "sm64 16 star");

    const client = new Client(
      socketUrl(base, slug),
      "raceme_session=guest-secret-guest-secret-guest",
    );

    const state = await client.waitFor((m) => m.type === "state");
    expect(state.type === "state" && state.race.goal).toBe("sm64 16 star");

    const feed = await client.waitFor((m) => m.type === "feed");
    expect(feed.type === "feed" && feed.entries.map((e) => e.text)).toEqual([
      "Goal Set: sm64 16 star",
    ]);
  });

  test("refuses a room without a usable goal", async () => {
    const base = start();
    const bodies = ["{}", '{"goal":"  "}', "not json", JSON.stringify({ goal: "x".repeat(201) })];

    for (const body of bodies) {
      const response = await fetch(`${base}/api/rooms`, {
        method: "POST",
        headers: { origin },
        body,
      });
      expect(response.status).toBe(400);
    }

    expect(running?.rooms.size).toBe(0);
  });

  test("tells whether a room code exists", async () => {
    const base = start();
    const { slug } = await createRoom(base);

    expect(await (await fetch(`${base}/api/rooms/${slug}`)).json()).toEqual({ exists: true });
    expect(await (await fetch(`${base}/api/rooms/aaaaaaaaaa`)).json()).toEqual({ exists: false });
  });

  test("rate limits room checks so codes can't be guessed", async () => {
    const base = start();

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await fetch(`${base}/api/rooms/aaaaaaaaaa`)).status);
    }

    expect(statuses.slice(0, 30).every((code) => code === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  test("room checks and room sockets share one lookup limit per IP", async () => {
    const base = start();
    const { slug } = await createRoom(base);

    for (let i = 0; i < 30; i++) {
      await fetch(`${base}/api/rooms/aaaaaaaaaa`);
    }

    expect((await upgrade(base, slug)).status).toBe(429);
  });

  test("caps open sockets per IP", async () => {
    const base = start({ maxSocketsPerIp: 2 });
    const { slug } = await createRoom(base);
    const cookie = "raceme_session=cap-secret-cap-secret-cap-secret-cap";

    const first = new Client(socketUrl(base, slug), cookie);
    const second = new Client(socketUrl(base, slug), cookie);
    await Promise.all([first.opened, second.opened]);

    expect((await upgrade(base, slug, { cookie })).status).toBe(429);
  });

  test("limits messages per IP across all its sockets", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const a = new Client(socketUrl(base, slug), "raceme_session=flood-a-flood-a-flood-a-flood-a");
    const b = new Client(socketUrl(base, slug), "raceme_session=flood-b-flood-b-flood-b-flood-b");
    await Promise.all([a.opened, b.opened]);

    for (let i = 0; i < 20; i++) {
      a.send({ type: "say", text: "x" });
      b.send({ type: "say", text: "x" });
    }

    const limited = await b.waitFor((m) => m.type === "refused" && m.refusal === "rateLimited");
    expect(limited).toBeTruthy();
  });

  test("refuses room creation from a foreign origin", async () => {
    const base = start();

    const response = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
  });

  test("sends strict security headers", async () => {
    const base = start();

    const response = await fetch(`${base}/api/rooms`, { method: "POST", headers: { origin } });

    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("runs a whole race between 2 clients", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const alice = new Client(
      socketUrl(base, slug),
      `${host}; raceme_session=alice-secret-alice-secret-alice`,
    );
    const bob = new Client(
      socketUrl(base, slug),
      "raceme_session=bob-secret-bob-secret-bob-secret",
    );
    await Promise.all([alice.opened, bob.opened]);

    const welcome = await alice.waitFor((m) => m.type === "welcome");
    expect(welcome.type === "welcome" && welcome.isHost).toBe(true);

    alice.send({ type: "join", name: "alice" });
    bob.send({ type: "join", name: "bob" });
    await bob.waitFor((m) => m.type === "state" && m.race.entrants.length === 2);

    alice.send({ type: "ready" });
    bob.send({ type: "ready" });
    await bob.waitFor(isPhase("countdown"));
    await bob.waitFor(isPhase("running"));

    clockOffsetMs += 6_000;
    alice.send({ type: "done" });
    bob.send({ type: "forfeit" });

    const finished = await bob.waitFor(isPhase("finished"));
    expect(finished.type === "state" && finished.race.entrants.map((e) => e.result?.kind)).toEqual([
      "done",
      "forfeit",
    ]);
  });

  test("the race still starts when the clock is behind as GO's timer fires", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      `${host}; raceme_session=slow-secret-slow-secret-slow-secret`,
    );
    await client.opened;
    client.send({ type: "join", name: "solo" });
    await client.waitFor((m) => m.type === "state" && m.race.entrants.length === 1);

    client.send({ type: "ready" });
    await client.waitFor(isPhase("countdown"));
    clockOffsetMs -= 300;

    expect(await client.waitFor(isPhase("running"))).toBeTruthy();
  });

  test("actions after .end don't push the 10 minute clear back", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      `${host}; raceme_session=late-secret-late-secret-late-secret`,
    );
    await client.opened;

    client.send({ type: "end" });
    await client.waitFor(isPhase("terminated"));

    clockOffsetMs += 9 * 60_000;
    client.send({ type: "setFractionDigits", digits: 2 });
    await client.waitFor((m) => m.type === "state" && m.race.settings.fractionDigits === 2);

    clockOffsetMs += 60_001;
    expect(await client.closed).toBe(4404);
  });

  test("an entrant reconnecting with the same cookies keeps their id and host rights", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const cookies = `${host}; raceme_session=back-secret-back-secret-back-secret`;
    const first = new Client(socketUrl(base, slug), cookies);
    const welcome = await first.waitFor((m) => m.type === "welcome");
    first.send({ type: "join", name: "back" });
    await first.waitFor((m) => m.type === "state" && m.race.entrants.length === 1);
    first.socket.close();
    await first.closed;

    const again = new Client(socketUrl(base, slug), cookies);
    const rewelcome = await again.waitFor((m) => m.type === "welcome");

    expect(rewelcome).toEqual(welcome);
    expect(rewelcome.type === "welcome" && rewelcome.isHost).toBe(true);
  });

  describe("game picker", () => {
    let upstream: ReturnType<typeof Bun.serve> | undefined;
    let upstreamRequests = 0;
    afterEach(() => {
      upstream?.stop();
      upstreamRequests = 0;
    });

    // Stands in for speedrun.com so the tests never leave this machine.
    function fakeSpeedrun(): string {
      upstream = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch(request) {
          upstreamRequests++;
          const url = new URL(request.url);
          if (url.pathname === "/api/v1/games") {
            const game = { id: "o1y9wo6q", names: { international: "Super Mario 64" } };
            return Response.json({ data: [game] });
          }
          if (url.pathname === "/api/v1/games/o1y9wo6q/categories") {
            return Response.json({ data: [{ id: "n2y55mko", name: "16 Star", type: "per-game" }] });
          }
          return new Response(null, { status: 404 });
        },
      });
      return `http://127.0.0.1:${upstream.port}/api`;
    }

    test("finds games and their categories through the server", async () => {
      const base = start({ speedrunApi: fakeSpeedrun() });

      const games = await (await fetch(`${base}/api/games?q=mario`)).json();
      const categories = await (await fetch(`${base}/api/games/o1y9wo6q/categories`)).json();

      expect(games).toEqual({ games: [{ id: "o1y9wo6q", name: "Super Mario 64" }] });
      expect(categories).toEqual({ categories: [{ id: "n2y55mko", name: "16 Star" }] });
    });

    test("answers 503 when speedrun.com can't be reached", async () => {
      const base = start({ speedrunApi: "http://127.0.0.1:9/api" });

      expect((await fetch(`${base}/api/games?q=mario`)).status).toBe(503);
    });

    test("is gone when the picker is turned off", async () => {
      const base = start();

      expect((await fetch(`${base}/api/games?q=mario`)).status).toBe(404);
    });

    test("rate limits lookups per IP", async () => {
      const base = start({ speedrunApi: fakeSpeedrun() });

      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) {
        statuses.push((await fetch(`${base}/api/games?q=mario`)).status);
      }

      expect(statuses.at(-1)).toBe(429);
    });

    // A pasted invite link must never reach speedrun.com, whatever the browser sends.
    test("never forwards a search that contains a live room's code", async () => {
      const base = start({ speedrunApi: fakeSpeedrun() });
      const { slug } = await createRoom(base);

      for (const q of [
        slug,
        `https://ero-qt.eu/apps/raceme/r/${slug}/`,
        `join ${slug.toUpperCase()}.`,
      ]) {
        const response = await fetch(`${base}/api/games?${new URLSearchParams({ q })}`);
        expect(await response.json()).toEqual({ games: [] });
      }

      expect(upstreamRequests).toBe(0);
    });

    test("answers 404 for a game id that can't be a speedrun.com id", async () => {
      const base = start({ speedrunApi: fakeSpeedrun() });

      expect((await fetch(`${base}/api/games/..%2Fusers/categories`)).status).toBe(404);
    });
  });

  test("a link to a room that is gone closes with code 4404", async () => {
    const base = start();

    const client = new Client(
      socketUrl(base, "aaaaaaaaaa"),
      "raceme_session=gone-secret-gone-secret-gone-secret",
    );

    expect(await client.closed).toBe(4404);
  });

  // RaceBot: "Race terminated. The channel will be cleared in 10 minutes!"
  test("an ended room clears after 10 minutes, closing its sockets with 4404", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      `${host}; raceme_session=end-secret-end-secret-end-secret-e`,
    );
    await client.opened;

    client.send({ type: "end" });
    await client.waitFor(isPhase("terminated"));
    clockOffsetMs += 10 * 60_000 + 1;

    expect(await client.closed).toBe(4404);
    expect(running?.rooms.get(slug)).toBeUndefined();
  });

  test("announces actions as RaceBot lines and relays chat", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const alice = new Client(
      socketUrl(base, slug),
      "raceme_session=alice-secret-alice-secret-alice",
    );
    const bob = new Client(
      socketUrl(base, slug),
      "raceme_session=bob-secret-bob-secret-bob-secret",
    );
    await Promise.all([alice.opened, bob.opened]);

    alice.send({ type: "join", name: "alice" });
    await bob.waitFor(
      (m) =>
        m.type === "feed" && m.entries.some((e) => e.text === "alice enters the race! 1 entrant."),
    );

    alice.send({ type: "say", text: "gl hf" });
    const chat = await bob.waitFor(
      (m) => m.type === "feed" && m.entries.some((e) => e.kind === "chat"),
    );
    expect(chat.type === "feed" && chat.entries.find((e) => e.kind === "chat")).toMatchObject({
      name: "alice",
      text: "gl hf",
    });
  });

  test("refuses chat before entering", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const guest = new Client(
      socketUrl(base, slug),
      "raceme_session=guest-secret-guest-secret-guest",
    );
    await guest.opened;

    guest.send({ type: "say", text: "hi" });

    const refused = await guest.waitFor((m) => m.type === "refused");
    expect(refused.type === "refused" && refused.refusal).toBe("notEntrant");
  });

  test("refuses setGoal from a guest", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const guest = new Client(
      socketUrl(base, slug),
      "raceme_session=guest-secret-guest-secret-guest",
    );
    await guest.opened;

    guest.send({ type: "setGoal", goal: "any%" });

    const refused = await guest.waitFor((m) => m.type === "refused");
    expect(refused.type === "refused" && refused.refusal).toBe("notHost");
  });

  test("refuses a websocket from a foreign origin", async () => {
    const base = start();
    const { slug } = await createRoom(base);

    const response = await upgrade(base, slug, { origin: "https://evil.example" });

    expect(response.status).toBe(403);
  });
});
