import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerConfig } from "../config.ts";
import { solveChallenge } from "../shared/proof-of-work.ts";
import type { ServerMessage } from "../shared/protocol.ts";
import { type RunningServer, startServer, steadyClock } from "./server.ts";

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
      idleInputMs: 2 * 60 * 60_000,
      idleWarningMs: 10 * 60_000,
      roomLifetimeMs: 48 * 60 * 60_000,
      closingWarningMs: 60 * 60_000,
      unusedRoomMs: 10 * 60_000,
      abandonedAfterMs: 10 * 60_000,
      abandonedRoomHeadroom: 0,
      surgeRoomsPerMinute: 1000,
      surgeBits: 8,
      countdownMs: 50,
      chatEveryMs: 3_000,
      maxSocketsPerIp: 10,
      maxSockets: 2000,
      sweepIntervalMs: 20,
      build: null,
      adminPort: null,
      restartHourUtc: 10,
      alertWebhook: null,
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
  readonly closeReason: Promise<string>;

  constructor(url: string, cookie: string) {
    this.socket = new WebSocket(url, { headers: { origin, cookie } } as never);
    this.socket.onmessage = (event) => this.messages.push(JSON.parse(String(event.data)));
    this.opened = new Promise((resolve) => {
      this.socket.onopen = () => resolve();
    });
    let reason: (text: string) => void = () => {};
    this.closeReason = new Promise((resolve) => {
      reason = resolve;
    });
    this.closed = new Promise((resolve) => {
      this.socket.onclose = (event) => {
        reason(event.reason);
        resolve(event.code);
      };
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

describe("steadyClock", () => {
  // Fractions of a millisecond would end up in finish times and exported `time_ms` values.
  test("counts whole milliseconds", () => {
    expect(Number.isInteger(steadyClock())).toBe(true);
  });
});

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

  test("asks new rooms for a proof of work once too many open in a minute", async () => {
    const base = start({ surgeRoomsPerMinute: 2 });
    for (let i = 0; i < 3; i++) {
      expect((await createRoom(base)).response.status).toBe(201);
    }

    const refused = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ goal: "any%" }),
    });
    expect(refused.status).toBe(428);

    const { challenge } = (await refused.json()) as { challenge: { token: string; bits: number } };
    const nonce = await solveChallenge(challenge.token, challenge.bits);
    const proven = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ goal: "any%", proof: { token: challenge.token, nonce } }),
    });
    expect(proven.status).toBe(201);
  });

  test("charges a room against the limits once, not for the proof of work challenge too", async () => {
    const base = start({ surgeRoomsPerMinute: 1 });
    const post = (body: object) =>
      fetch(`${base}/api/rooms`, {
        method: "POST",
        headers: { origin },
        body: JSON.stringify(body),
      });
    for (let i = 0; i < 2; i++) {
      expect((await post({ goal: "any%" })).status).toBe(201);
    }

    // 5 rooms per address fit in the limit: 2 above and 3 more behind a proof of work each.
    for (let i = 0; i < 3; i++) {
      const refused = await post({ goal: "any%" });
      expect(refused.status).toBe(428);
      const { challenge } = (await refused.json()) as {
        challenge: { token: string; bits: number };
      };
      const nonce = await solveChallenge(challenge.token, challenge.bits);
      expect((await post({ goal: "any%", proof: { token: challenge.token, nonce } })).status).toBe(
        201,
      );
    }
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

  test("a socket over its own limit leaves the IP's shared limit to its neighbours", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const a = new Client(socketUrl(base, slug), "raceme_session=spam-a-spam-a-spam-a-spam-a-spam");
    const b = new Client(socketUrl(base, slug), "raceme_session=calm-b-calm-b-calm-b-calm-b-calm");
    await Promise.all([a.opened, b.opened]);

    for (let i = 0; i < 40; i++) {
      a.send({ type: "ready" });
    }
    await a.waitFor((m) => m.type === "refused" && m.refusal === "rateLimited");
    b.send({ type: "ready" });

    const answer = await b.waitFor((m) => m.type === "refused");
    expect(answer).toMatchObject({ refusal: "notEntrant" });
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

  test("serves the page at the base path without a trailing slash", async () => {
    const staticDir = mkdtempSync(join(tmpdir(), "raceme-static-"));
    writeFileSync(join(staticDir, "index.html"), "<title>raceme</title>");
    const base = start({ staticDir });

    const response = await fetch(base, { redirect: "manual" });

    expect([response.status, await response.text()]).toEqual([200, "<title>raceme</title>"]);
    rmSync(staticDir, { recursive: true });
  });

  test("tells how many rooms are open and people are online", async () => {
    const base = start();
    expect(await (await fetch(`${base}/api/status`)).json()).toEqual({
      rooms: 0,
      people: 0,
      restartAt: null,
    });
    const { slug } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      "raceme_session=count-secret-count-secret-count",
    );
    await client.waitFor((m) => m.type === "state");

    expect(await (await fetch(`${base}/api/status`)).json()).toEqual({
      rooms: 1,
      people: 1,
      restartAt: null,
    });
  });

  test("asks search engines to leave every page out", async () => {
    const base = start();

    expect((await fetch(`${base}/api/build`)).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow",
    );
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

  describe("build info", () => {
    test("answers with the commit and release digest the deploy wrote", async () => {
      const build = {
        release: "1.2.0",
        repository: "https://github.com/ero-qt/raceme",
        commit: "a".repeat(40),
        digest: `sha256:${"b".repeat(64)}`,
      };
      const base = start({ build });

      expect(await (await fetch(`${base}/api/build`)).json()).toEqual(build);
    });

    test("answers with nulls for a build that didn't come from a release", async () => {
      const base = start();

      expect(await (await fetch(`${base}/api/build`)).json()).toEqual({
        release: null,
        repository: null,
        commit: null,
        digest: null,
      });
    });
  });

  test("posts to the alert webhook once 5 people are online", async () => {
    const posts: unknown[] = [];
    const webhook = Bun.serve({
      port: 0,
      async fetch(request) {
        posts.push(await request.json());
        return new Response(null, { status: 204 });
      },
    });
    const base = start({ alertWebhook: `http://127.0.0.1:${webhook.port}/hook` });
    const { slug } = await createRoom(base);

    const clients = Array.from(
      { length: 5 },
      (_, i) =>
        new Client(socketUrl(base, slug), `raceme_session=${`person-${i}-`.padEnd(32, "x")}`),
    );
    await Promise.all(clients.map((client) => client.waitFor((m) => m.type === "state")));
    for (let i = 0; i < 50 && posts.length === 0; i++) {
      await Bun.sleep(10);
    }

    expect(posts).toEqual([{ content: "raceme: 5 people online" }]);
    webhook.stop(true);
  });

  describe("queued restart", () => {
    const adminUrl = () => `http://127.0.0.1:${running?.admin?.port}/restart`;

    test("moves every room's close time to the next restart and tells the room", async () => {
      clockOffsetMs = Date.UTC(2026, 9, 25, 7) - Date.now();
      const base = start({ adminPort: 0 });
      const { slug } = await createRoom(base);
      const client = new Client(
        socketUrl(base, slug),
        "raceme_session=queue-secret-queue-secret-queue-se",
      );
      await client.waitFor((m) => m.type === "state");

      const queued = await (await fetch(adminUrl(), { method: "POST" })).json();
      const restartAt = Date.UTC(2026, 9, 25, 10);

      expect(queued).toEqual({ restartAt, rooms: 1 });
      await client.waitFor((m) => m.type === "state" && m.closesAt === restartAt);
      await client.waitFor(
        (m) =>
          m.type === "feed" &&
          m.entries.some(
            (e) => e.text === "Server restart queued for 10:00 UTC. This room closes then.",
          ),
      );
    });

    test("marks the state as closing for the restart and shows the restart on the public API", async () => {
      clockOffsetMs = Date.UTC(2026, 9, 25, 7) - Date.now();
      const base = start({ adminPort: 0 });
      const { slug } = await createRoom(base);
      expect(await (await fetch(`${base}/api/status`)).json()).toMatchObject({ restartAt: null });

      await fetch(adminUrl(), { method: "POST" });
      const client = new Client(
        socketUrl(base, slug),
        "raceme_session=mark-secret-mark-secret-mark-secr",
      );

      await client.waitFor((m) => m.type === "state" && m.closesFor === "restart");
      expect(await (await fetch(`${base}/api/status`)).json()).toMatchObject({
        restartAt: Date.UTC(2026, 9, 25, 10),
      });
    });

    test("warns every room once the restart is less than an hour away", async () => {
      clockOffsetMs = Date.UTC(2026, 9, 25, 9, 30) - Date.now();
      const base = start({ adminPort: 0 });
      const { slug } = await createRoom(base);
      const client = new Client(
        socketUrl(base, slug),
        "raceme_session=warn-secret-warn-secret-warn-secr",
      );
      await client.waitFor((m) => m.type === "state");

      await fetch(adminUrl(), { method: "POST" });

      await client.waitFor(
        (m) => m.type === "restartWarning" && m.closesAt === Date.UTC(2026, 9, 25, 10),
      );
    });

    test("reports the open rooms without queueing, and stays off the public port", async () => {
      const base = start({ adminPort: 0 });
      await createRoom(base);

      expect(await (await fetch(adminUrl())).json()).toEqual({ restartAt: null, rooms: 1 });
      expect((await fetch(`${base}/restart`, { method: "POST" })).status).toBe(404);
    });
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
        `https://ero-qt.eu/apps/raceme/${slug}/`,
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

  test("RaceBot warns 1 hour before a room reaches its lifetime", async () => {
    const base = start({ idleMs: 100 * 60 * 60_000, roomLifetimeMs: 3 * 60 * 60_000 });
    const { slug } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      "raceme_session=old-secret-old-secret-old-secret-old",
    );
    await client.opened;

    clockOffsetMs += 2 * 60 * 60_000;

    const warning = await client.waitFor(
      (m) =>
        m.type === "feed" &&
        m.entries.some((e) => e.text.includes("closes in 1 hour. Rooms last at most 3 hours")),
    );
    expect(warning).toBeTruthy();
  });

  test("an idle room warns after 2 hours and closes 10 minutes later unless someone acts", async () => {
    const base = start({ idleMs: 100 * 60 * 60_000 });
    const { slug } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      "raceme_session=idle-secret-idle-secret-idle-secret",
    );
    await client.opened;

    clockOffsetMs += 2 * 60 * 60_000;
    const warning = await client.waitFor((m) => m.type === "idleWarning");
    expect(warning.type === "idleWarning" && warning.closesAt).toBeGreaterThan(Date.now());
    const line = (text: string) => (m: ServerMessage) =>
      m.type === "feed" && m.entries.some((e) => e.text === text);
    expect(await client.waitFor(line("Room closes soon due to inactivity!"))).toBeTruthy();

    client.send({ type: "active" });
    await client.waitFor((m) => m.type === "idleCleared");

    clockOffsetMs += 2 * 60 * 60_000 + 10 * 60_000;
    expect(await client.closed).toBe(4404);
  });

  test("someone opening an idle room counts as activity and clears the warning", async () => {
    const base = start({ idleMs: 100 * 60 * 60_000 });
    const { slug } = await createRoom(base);
    const first = new Client(
      socketUrl(base, slug),
      "raceme_session=one-secret-one-secret-one-secret-o",
    );
    await first.opened;
    clockOffsetMs += 2 * 60 * 60_000;
    await first.waitFor((m) => m.type === "idleWarning");

    const late = new Client(
      socketUrl(base, slug),
      "raceme_session=two-secret-two-secret-two-secret-t",
    );
    await late.opened;

    expect(await first.waitFor((m) => m.type === "idleCleared")).toBeTruthy();
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
    expect(await client.closeReason).toBe("room closed: the race ended.");
  });

  test("tells the room when it closes: 48 hours after opening, or 10 minutes after .end", async () => {
    const base = start();
    const { slug, host } = await createRoom(base);
    const client = new Client(
      socketUrl(base, slug),
      `${host}; raceme_session=due-secret-due-secret-due-secret-d`,
    );
    const opened = await client.waitFor((m) => m.type === "state");
    const lifetime = opened.type === "state" ? opened.closesAt - opened.serverNow : 0;
    expect(lifetime).toBeGreaterThan(48 * 60 * 60_000 - 5_000);
    expect(lifetime).toBeLessThanOrEqual(48 * 60 * 60_000);

    client.send({ type: "end" });
    const ended = await client.waitFor(isPhase("terminated"));
    expect(ended.type === "state" && ended.closesAt - (ended.race.endedAt ?? 0)).toBe(10 * 60_000);

    client.send({ type: "rematch" });
    await client.waitFor((m) => m.type === "feed" && m.entries.some((e) => e.text === "Rematch!"));
    const rematched = client.messages.filter((m) => m.type === "state").at(-1);
    expect(rematched?.type === "state" && rematched.closesAt).toBe(
      opened.type === "state" ? opened.closesAt : 0,
    );
  });

  test("tells everyone in a room how many people watch it without entering", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const first = new Client(
      socketUrl(base, slug),
      "raceme_session=see-secret-see-secret-see-secret-se",
    );
    await first.opened;
    const watcher = new Client(
      socketUrl(base, slug),
      "raceme_session=two-watch-two-watch-two-watch-tw",
    );
    await watcher.opened;

    const latestWatchers = () => {
      const state = first.messages.filter((m) => m.type === "state").at(-1);
      return state?.type === "state" ? state.watchers : null;
    };
    await first.waitFor(() => latestWatchers() === 2);
    first.send({ type: "join", name: "alice" });
    await first.waitFor(() => latestWatchers() === 1);
    watcher.socket.close();
    await first.waitFor(() => latestWatchers() === 0);
  });

  // A fresh state resets every client's clock offset, so it only goes out when the count changes.
  test("sends a second tab of the same session its state without telling the room", async () => {
    const base = start();
    const { slug } = await createRoom(base);
    const cookie = "raceme_session=tab-secret-tab-secret-tab-secret-ta";
    const first = new Client(socketUrl(base, slug), cookie);
    await first.waitFor((m) => m.type === "state");
    const statesBefore = first.messages.filter((m) => m.type === "state").length;

    const second = new Client(socketUrl(base, slug), cookie);
    await second.waitFor((m) => m.type === "state");
    second.socket.close();
    await Bun.sleep(50);

    expect(first.messages.filter((m) => m.type === "state").length).toBe(statesBefore);
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
