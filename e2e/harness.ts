import { join } from "node:path";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import type { ServerConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server/server.ts";

export interface Harness {
  origin: string;
  browser: Browser;
  server: RunningServer;
  close(): Promise<void>;
}

/**
 * Stands in for speedrun.com with one game and its categories, so the browser tests never call
 * the real site.
 */
function startFakeSpeedrun() {
  return Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/v2/GetSearch") {
        return Response.json({ gameList: [{ id: "o1y9wo6q", name: "Super Mario 64" }] });
      }
      if (pathname === "/api/v1/games/o1y9wo6q/categories") {
        const names = ["120 Star", "70 Star", "16 Star"];
        const data = names.map((name, i) => ({ id: `cat${i}0000`, name, type: "per-game" }));
        return Response.json({ data });
      }
      return new Response(null, { status: 404 });
    },
  });
}

/** Starts the real server on a free port with the built page, plus a headless Chromium. */
export async function startHarness(overrides: Partial<ServerConfig> = {}): Promise<Harness> {
  const speedrun = startFakeSpeedrun();
  const server = startServer({
    port: 0,
    hostname: "127.0.0.1",
    // Chromium treats localhost as a secure context, so Secure cookies work over plain http here.
    secureCookies: true,
    basePath: "",
    origin: null,
    staticDir: join(import.meta.dir, "..", "dist", "client"),
    trustProxy: false,
    speedrunApi: `http://127.0.0.1:${speedrun.port}/api`,
    maxRooms: 100,
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
    countdownMs: 1_000,
    chatEveryMs: 3_000,
    maxSocketsPerIp: 50,
    maxSockets: 200,
    sweepIntervalMs: 60_000,
    build: null,
    adminPort: null,
    alertWebhook: null,
    restartHourUtc: 10,
    ...overrides,
  });
  const origin = `http://localhost:${server.server.port}`;
  const browser = await chromium.launch();

  return {
    origin,
    browser,
    server,
    async close() {
      await browser.close();
      server.stop();
      speedrun.stop();
    },
  };
}

/** Opens a lobby from the start page and enters it under `name`. */
export async function openLobbyAndEnter(page: Page, origin: string, name: string): Promise<void> {
  await page.goto(`${origin}/`);
  await page.getByLabel("goal or room code").fill("sm64 16 star");
  await page.getByRole("button", { name: ".startrace" }).click();
  await page.getByLabel("your name").fill(name);
  await page.getByRole("button", { name: ".enter" }).click();
  await page.getByRole("button", { name: ".ready" }).waitFor();
}

export async function newPage(
  harness: Harness,
  options: { bypassCSP?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await harness.browser.newContext({
    // Wide enough for the desktop layout, where the header sits beside the page column.
    viewport: { width: 1280, height: 900 },
    // Turns the page's transitions off, so axe never measures a color halfway through a fade.
    reducedMotion: "reduce",
    bypassCSP: options.bypassCSP ?? false,
    acceptDownloads: true,
  });

  return { context, page: await context.newPage() };
}
