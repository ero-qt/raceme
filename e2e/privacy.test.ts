import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Harness, newPage, openLobbyAndEnter, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(() => harness.close());

describe("privacy", () => {
  // Every request of a whole race, page, assets, socket and download, must stay on raceme's origin.
  test("a full race never contacts another host", async () => {
    const { context, page } = await newPage(harness);
    const contacted = new Set<string>();
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol !== "blob:" && url.protocol !== "data:") {
        contacted.add(url.origin.replace(/^ws/, "http"));
      }
    });
    page.on("websocket", (socket) =>
      contacted.add(new URL(socket.url()).origin.replace(/^ws/, "http")),
    );

    await openLobbyAndEnter(page, harness.origin, "ero");
    await page.getByLabel("message").fill("gl hf");
    await page.getByRole("button", { name: "send" }).click();
    await page.getByRole("button", { name: ".ready" }).click();
    await page.getByRole("button", { name: ".done" }).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(5_200);
    await page.getByRole("button", { name: ".done" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "download CSV" }).click(),
    ]);
    await download.path();

    expect([...contacted]).toEqual([harness.origin]);

    await context.close();
  }, 30_000);

  test("stores only the 2 HttpOnly cookies the race needs and the viewer's own goal list", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "ero");

    const cookies = await context.cookies();
    expect(cookies.map((c) => c.name.replace(/_[a-z2-7]{10}$/, "_<room>")).sort()).toEqual([
      "raceme_host_<room>",
      "raceme_session",
    ]);
    expect(cookies.every((c) => c.httpOnly && c.sameSite === "Strict")).toBe(true);

    const storage = await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      databases: (await indexedDB.databases()).length,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      caches: (await caches.keys()).length,
    }));

    expect(storage).toEqual({
      local: ["raceme.goalHistory"],
      session: [],
      databases: 0,
      workers: 0,
      caches: 0,
    });

    await context.close();
  }, 20_000);
});
