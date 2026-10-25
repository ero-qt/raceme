import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";
import { type Harness, newPage, openLobbyAndEnter, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(() => harness.close());

// Rounds to whole pixels so subpixel antialiasing doesn't count as movement.
async function positions(page: Page): Promise<Record<string, number[]>> {
  const box = async (name: string, selector: string, hasText?: RegExp) => {
    const rect = await page
      .locator(selector, hasText ? { hasText } : {})
      .first()
      .boundingBox();
    if (!rect) {
      throw new Error(`no box for ${name}`);
    }
    return [rect.x, rect.y, rect.width].map(Math.round);
  };

  return {
    title: await box("title", "h2"),
    count: await box("count", "h2 + span"),
    watchers: await box("watchers", "[title$=' watching']"),
    status: await box("status", "h2 ~ span", /^(Entry|Starting|In progress|Complete|Terminated)/),
    nameColumn: await box("nameColumn", "th >> text=Name"),
    statusColumn: await box("statusColumn", "th >> text=Status"),
    timeColumn: await box("timeColumn", "th >> text=Time"),
    chat: await box("chat", "[aria-label='Chat']"),
    clock: await box("clock", "[role='timer']"),
    roomTimer: await box("roomTimer", "button[aria-label^='room closes']"),
  };
}

describe("room layout", () => {
  test("nothing moves when the cap, the statuses or the phase change", async () => {
    const host = await newPage(harness);
    await openLobbyAndEnter(host.page, harness.origin, "ero");
    const guest = await newPage(harness);
    await guest.page.goto(host.page.url());
    await guest.page.getByLabel("Your name").fill("guest");
    await guest.page.getByRole("button", { name: ".enter" }).click();
    await host.page.getByText("2/").waitFor();
    const before = await positions(host.page);

    // Someone opening the room without entering changes the watcher count from 0 to 1.
    const watcher = await newPage(harness);
    await watcher.page.goto(host.page.url());
    await host.page.getByTitle("1 watching").waitFor();
    expect(await positions(host.page)).toEqual(before);
    await watcher.context.close();

    const limit = host.page.getByLabel("Entrant limit");
    const setCap = async (cap: string) => {
      await limit.fill(cap);
      await limit.blur();
      await host.page.waitForFunction(
        (want) =>
          (document.querySelector("[aria-label='Entrant limit']") as HTMLInputElement).value ===
          want,
        cap,
      );
    };
    await setCap("8");
    await setCap("50");
    expect(await positions(host.page)).toEqual(before);

    await setCap("8");
    expect(await positions(host.page)).toEqual(before);

    await host.page.getByRole("button", { name: ".ready" }).click();
    await guest.page.getByRole("button", { name: ".ready" }).click();
    await host.page.getByText("Starting").waitFor();
    expect(await positions(host.page)).toEqual(before);

    await host.page.getByText("In progress").waitFor();
    expect(await positions(host.page)).toEqual(before);

    await host.context.close();
    await guest.context.close();
  }, 30_000);
});

describe("room layout on phones", () => {
  test("the entrants header fits a 320 and a 390 pixel wide screen", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "ero");

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(() => {
        const header = document.querySelector("h2")?.parentElement as HTMLElement;
        return header.scrollWidth - header.clientWidth;
      });
      expect([width, overflow]).toEqual([width, 0]);
    }

    await context.close();
  });
});
