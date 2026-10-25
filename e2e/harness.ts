import { join } from "node:path";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { type RunningServer, startServer } from "../src/server/server.ts";

export interface Harness {
  origin: string;
  browser: Browser;
  server: RunningServer;
  close(): Promise<void>;
}

/** Starts the real server on a free port with the built page, plus a headless Chromium. */
export async function startHarness(): Promise<Harness> {
  const server = startServer({
    port: 0,
    hostname: "127.0.0.1",
    // Chromium treats localhost as a secure context, so Secure cookies work over plain http here.
    secureCookies: true,
    basePath: "",
    origin: null,
    staticDir: join(import.meta.dir, "..", "dist", "client"),
    trustProxy: false,
    maxRooms: 100,
    idleMs: 60_000,
    countdownMs: 1_000,
    maxSocketsPerIp: 50,
    maxSockets: 200,
    sweepIntervalMs: 60_000,
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
    },
  };
}

/** Opens a lobby from the start page and enters it under `name`. */
export async function openLobbyAndEnter(page: Page, origin: string, name: string): Promise<void> {
  await page.goto(`${origin}/`);
  await page.getByLabel("Goal or room code").fill("sm64 16 star");
  await page.getByRole("button", { name: ".startrace" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: ".enter" }).click();
  await page.getByRole("button", { name: ".ready" }).waitFor();
}

export async function newPage(
  harness: Harness,
  options: { colorScheme?: "dark" | "light"; bypassCSP?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await harness.browser.newContext({
    // Wide enough for the desktop layout, where the header sits beside the page column.
    viewport: { width: 1280, height: 900 },
    colorScheme: options.colorScheme ?? "dark",
    bypassCSP: options.bypassCSP ?? false,
    acceptDownloads: true,
  });

  return { context, page: await context.newPage() };
}
