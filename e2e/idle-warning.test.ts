import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Harness, newPage, openLobbyAndEnter, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness({ idleInputMs: 1_000, sweepIntervalMs: 200 });
});

afterAll(() => harness.close());

describe("idle warning", () => {
  test("one person's input clears the warning for everyone in the room", async () => {
    const host = await newPage(harness);
    await openLobbyAndEnter(host.page, harness.origin, "ero");
    const guest = await newPage(harness);
    await guest.page.goto(host.page.url());

    const hostCard = host.page
      .getByRole("alert")
      .filter({ hasText: "room closes soon due to inactivity!" });
    const guestCard = guest.page
      .getByRole("alert")
      .filter({ hasText: "room closes soon due to inactivity!" });
    await hostCard.waitFor({ timeout: 10_000 });
    await guestCard.waitFor({ timeout: 10_000 });
    // The room behind the warning dims, since nothing there is meant to be read while it shows.
    const scrim = await hostCard.evaluate(
      (card) => getComputedStyle(card.parentElement as Element).backgroundColor,
    );
    expect(scrim).toBe("rgba(0, 0, 0, 0.45)");

    await guest.page.mouse.move(200, 200);
    await guest.page.mouse.move(240, 240);

    await hostCard.waitFor({ state: "detached", timeout: 5_000 });
    expect(await guestCard.count()).toBe(0);

    await host.context.close();
    await guest.context.close();
  }, 30_000);
});
