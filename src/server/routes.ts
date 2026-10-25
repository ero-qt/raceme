import type { Server } from "bun";
import { createRace } from "../shared/race/race.ts";
import { sessionCookieDays } from "../shared/retention.ts";
import type { ClientLimits } from "./client-limits.ts";
import { cookie, isAllowedOrigin, json, rateLimitKey, readCookie, status } from "./http.ts";
import { TokenBucket } from "./rate-limit.ts";
import { applyAndAnnounce } from "./room-actions.ts";
import { botLines } from "./room-hub.ts";
import type { SocketData } from "./room-socket.ts";
import type { Room, RoomRegistry } from "./rooms.ts";
import type { ServerConfig } from "./server.ts";
import {
  type CatalogEntry,
  type CatalogResult,
  type SpeedrunCatalog,
  isGameId,
} from "./speedrun.ts";
import { serveStatic } from "./static.ts";
import type { SurgeGuard } from "./surge.ts";
import { randomSecret } from "./tokens.ts";

interface RouteDeps {
  config: ServerConfig;
  rooms: RoomRegistry;
  limits: ClientLimits;
  catalog: SpeedrunCatalog | null;
  surge: SurgeGuard;
  clock: () => number;
  /** Runs when a room opens, for the spike alerts. */
  countsChanged?: () => void;
}

type Router = (request: Request, server: Server<SocketData>) => Promise<Response | undefined>;

const sessionCookie = "raceme_session";
const sessionMaxAgeSeconds = sessionCookieDays * 24 * 60 * 60;
const roomSocketPath = /^\/api\/rooms\/([a-z2-7]{10})\/ws$/;
const roomCheckPath = /^\/api\/rooms\/([a-z2-7]{10})$/;
const categoriesPath = /^\/api\/games\/([^/]+)\/categories$/;
const roomCodeToken = /(?<![a-z0-9])[a-z2-7]{10}(?![a-z0-9])/g;

/** Builds the HTTP router: room creation, room checks, socket upgrades and the built page. */
export function createRouter(deps: RouteDeps): Router {
  const { config } = deps;

  return async (request, server) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${config.basePath}/`)) {
      return status(404);
    }
    const path = url.pathname.slice(config.basePath.length);
    const ip = clientIp(config, request, server);

    if (path === "/api/rooms") {
      return request.method === "POST" ? createRoom(deps, request, ip) : status(405);
    }
    const checkSlug = roomCheckPath.exec(path)?.[1];
    if (checkSlug) {
      return request.method === "GET" ? checkRoom(deps, checkSlug, ip) : status(405);
    }
    if (path === "/api/restart") {
      return request.method === "GET" ? json({ restartAt: deps.rooms.restartAt }) : status(405);
    }
    if (path === "/api/build") {
      return request.method === "GET"
        ? json(config.build ?? { release: null, repository: null, commit: null, digest: null })
        : status(405);
    }
    if (path === "/api/games") {
      return request.method === "GET" ? searchGames(deps, url, ip) : status(405);
    }
    const gameId = categoriesPath.exec(path)?.[1];
    if (gameId) {
      return request.method === "GET" ? listCategories(deps, gameId, ip) : status(405);
    }
    const socketSlug = roomSocketPath.exec(path)?.[1];
    if (socketSlug) {
      return upgradeRoomSocket(deps, { request, server, slug: socketSlug, ip });
    }

    const readsPage = request.method === "GET" || request.method === "HEAD";
    if (path.startsWith("/api/") || config.staticDir === null || !readsPage) {
      return status(404);
    }
    return serveStatic(config.staticDir, path);
  };
}

function clientIp(config: ServerConfig, request: Request, server: Server<SocketData>): string {
  const forwarded = config.trustProxy ? request.headers.get("x-forwarded-for") : null;
  // Caddy appends the real peer last, so earlier entries may be forged by the client.
  const last = forwarded?.split(",").at(-1)?.trim();
  return rateLimitKey(last || server.requestIP(request)?.address || "unknown");
}

/** Opens a room with the goal from the request body, since the goal is what makes a lobby. */
async function createRoom(deps: RouteDeps, request: Request, ip: string): Promise<Response> {
  const { config, rooms, limits, surge, clock } = deps;
  if (!isAllowedOrigin(request, config.origin)) {
    return status(403);
  }
  const body = readRoomRequest(await request.text());
  if (surge.needsProof()) {
    const proven =
      body.proof !== null && (await surge.acceptProof(body.proof.token, body.proof.nonce));
    if (!proven) {
      return json({ challenge: surge.issueChallenge() }, 428);
    }
  }
  // Charges the limits only for a request that can open a room, so the challenge round trip of a
  // proof of work doesn't cost a second room.
  if (!limits.createRoom(ip)) {
    return status(429);
  }

  const now = clock();
  const settings = { countdownMs: config.countdownMs };
  const goal = body.goal;
  const withGoal = applyAndAnnounce(createRace(settings), { type: "setGoal", goal }, now);
  if (!withGoal.ok) {
    return status(400);
  }

  const created = rooms.create(settings, now);
  deps.countsChanged?.();
  if (!created.ok) {
    return status(503);
  }
  created.room.race = withGoal.state;
  created.room.feed.add(botLines(withGoal.lines, now));
  surge.recordRoom();

  const response = json({ slug: created.room.slug }, 201);
  const hostCookie = cookie(
    hostCookieName(created.room.slug),
    created.hostToken,
    cookieOptions(config),
  );
  response.headers.append("set-cookie", hostCookie);
  return response;
}

/**
 * Reads the goal and an optional proof of work from a JSON body. An unusable goal becomes `""`,
 * so the race rules refuse it.
 */
function readRoomRequest(body: string): {
  goal: string;
  proof: { token: string; nonce: number } | null;
} {
  try {
    const { goal, proof } = JSON.parse(body) as {
      goal?: unknown;
      proof?: { token?: unknown; nonce?: unknown };
    };
    const token = proof?.token;
    const nonce = proof?.nonce;
    return {
      goal: typeof goal === "string" ? goal : "",
      proof: typeof token === "string" && typeof nonce === "number" ? { token, nonce } : null,
    };
  } catch {
    return { goal: "", proof: null };
  }
}

/** Tells the start page whether a pasted code belongs to a live room, rate limited per IP. */
function checkRoom({ rooms, limits }: RouteDeps, slug: string, ip: string): Response {
  if (!limits.lookUpRoom(ip)) {
    return status(429);
  }

  // Answers 200 either way so browsers don't log a missing room as a failed request.
  return json({ exists: rooms.get(slug) !== undefined });
}

/** Finds speedrun.com games for the start page's picker, through the server so browsers never contact it. */
async function searchGames(deps: RouteDeps, url: URL, ip: string): Promise<Response> {
  const { catalog, limits, rooms } = deps;
  if (catalog === null) {
    return status(404);
  }
  if (!limits.lookUpGame(ip)) {
    return status(429);
  }

  const query = url.searchParams.get("q") ?? "";
  const codes = roomCodesIn(query);
  // A search with a code costs a room lookup as well, so it never finds live rooms cheaper than the room check.
  if (codes.length > 0 && !limits.lookUpRoom(ip)) {
    return status(429);
  }
  // A pasted invite link must never reach speedrun.com, whatever the browser sends.
  if (codes.some((code) => rooms.get(code) !== undefined)) {
    return json({ games: [] });
  }

  return catalogResponse(await catalog.searchGames(query), (games) => ({ games }));
}

/** Lists a speedrun.com game's categories for the picker's category select. */
async function listCategories(deps: RouteDeps, gameId: string, ip: string): Promise<Response> {
  const { catalog, limits } = deps;
  if (catalog === null || !isGameId(gameId)) {
    return status(404);
  }
  if (!limits.lookUpGame(ip)) {
    return status(429);
  }

  return catalogResponse(await catalog.categories(gameId), (categories) => ({ categories }));
}

function catalogResponse(
  result: CatalogResult,
  body: (entries: CatalogEntry[]) => object,
): Response {
  return result === "unavailable" ? status(503) : json(body(result));
}

/** Finds every token shaped like a room code, on its own or at the end of an invite link. */
function roomCodesIn(text: string): string[] {
  return [...text.toLowerCase().matchAll(roomCodeToken)].map((match) => match[0]);
}

interface UpgradeRequest {
  request: Request;
  server: Server<SocketData>;
  slug: string;
  ip: string;
}

function upgradeRoomSocket(deps: RouteDeps, upgrade: UpgradeRequest): Response | undefined {
  const { config, rooms, limits, clock } = deps;
  const { request, server, slug, ip } = upgrade;
  if (!isAllowedOrigin(request, config.origin)) {
    return status(403);
  }
  if (!limits.lookUpRoom(ip) || !limits.hasSocketCapacity(ip)) {
    return status(429);
  }

  const room = rooms.get(slug);
  if (!room) {
    // Upgrades anyway so the client gets the room-gone close code instead of a failed connect.
    const gone: SocketData = {
      slug,
      ip,
      sessionSecret: "",
      entrantId: "",
      isHost: false,
      bucket: new TokenBucket(0, 0, clock()),
    };
    return server.upgrade(request, { data: gone }) ? undefined : status(400);
  }

  return upgradeIntoRoom(deps, upgrade, room);
}

function upgradeIntoRoom(
  { config, clock }: RouteDeps,
  { request, server, slug, ip }: UpgradeRequest,
  room: Room,
): Response | undefined {
  const existing = readCookie(request, sessionCookie);
  const secret = existing && existing.length >= 32 ? existing : randomSecret();
  const entrantId = room.entrantIdFor(secret);
  if (entrantId === null) {
    return status(503);
  }

  const hostToken = readCookie(request, hostCookieName(slug));
  const data: SocketData = {
    slug,
    ip,
    sessionSecret: secret,
    entrantId,
    isHost: hostToken !== null && room.isHost(hostToken),
    bucket: new TokenBucket(20, 5, clock()),
  };
  const headers: Record<string, string> =
    secret === existing
      ? {}
      : { "set-cookie": cookie(sessionCookie, secret, cookieOptions(config)) };
  if (server.upgrade(request, { data, headers })) {
    return undefined;
  }

  room.releaseUnusedSession(secret);
  return status(400);
}

function hostCookieName(slug: string): string {
  return `raceme_host_${slug}`;
}

// The host cookie lives as long as the session cookie, so a host who comes back keeps host rights.
function cookieOptions(config: ServerConfig) {
  return {
    path: config.basePath || "/",
    maxAgeSeconds: sessionMaxAgeSeconds,
    secure: config.secureCookies,
  };
}
