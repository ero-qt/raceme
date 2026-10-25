import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Harness, newPage, openLobbyAndEnter, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(() => harness.close());

describe("leaving a room", () => {
  test("going home resets the tab title and closes the room's socket", async () => {
    const { context, page } = await newPage(harness);
    const socketClosed = new Promise<void>((resolve) => {
      page.on("websocket", (socket) => socket.on("close", () => resolve()));
    });
    await openLobbyAndEnter(page, harness.origin, "ero");

    expect(await page.title()).toBe("sm64 16 star · raceme");

    await page.getByRole("link", { name: "raceme" }).click();
    await page.getByLabel("Goal or room code").waitFor();
    await socketClosed;

    expect(await page.title()).toBe("raceme");

    await context.close();
  }, 20_000);
});
