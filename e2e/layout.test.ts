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
    roomTimer: await box("roomTimer", "button[aria-label^='Room closes']"),
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

describe("entrant table on phones", () => {
  // A finished entrant's time takes the place of the Done badge, so the name keeps room to read.
  test("leaves the host at least 100 pixels for names on a 412 and a 360 pixel wide screen", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "ero");

    for (const width of [412, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.getByRole("columnheader", { name: "Time" }).waitFor({ state: "detached" });
      const sizes = await page.evaluate(() => {
        const name = [...document.querySelectorAll("th")].find((th) => th.textContent === "Name");
        return {
          name: Math.round(name?.getBoundingClientRect().width ?? 0),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect([width, sizes.name >= 100, sizes.overflow]).toEqual([width, true, 0]);
    }

    await context.close();
  });
});

describe("home layout", () => {
  test("the start form stays put when the corner notes open", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const form = page.getByLabel("Goal or room code");
    const before = await form.boundingBox();

    await page.getByText("Privacy", { exact: true }).click();
    await page.getByText("The server keeps nothing on disk.").waitFor();
    expect(await form.boundingBox()).toEqual(before);

    await page.getByText("Made with AI", { exact: true }).click();
    await page.getByText("i'm not proud, but i think it's useful.").waitFor();
    expect(await form.boundingBox()).toEqual(before);

    await context.close();
  });

  test("the corner note summaries stay put when a note opens above them", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const summaries = page.locator("summary");
    const boxes = async () =>
      Promise.all((await summaries.all()).map(async (summary) => await summary.boundingBox()));
    const before = await boxes();

    await page.getByText("Privacy", { exact: true }).click();
    const notice = page.getByText("The server keeps nothing on disk.");
    await notice.waitFor();
    expect(await boxes()).toEqual(before);
    expect(((await notice.boundingBox())?.y ?? 0) < (before[0]?.y ?? 0)).toBe(true);

    // Opening the other note closes this one, so 2 notes never cover each other.
    await page.getByText("Made with AI", { exact: true }).click();
    await page.getByText("i'm not proud, but i think it's useful.").waitFor();
    expect(await notice.isVisible()).toBe(false);
    expect(await boxes()).toEqual(before);

    await context.close();
  });

  test("an open note uses the height above the summaries before it scrolls", async () => {
    const { context, page } = await newPage(harness);
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`${harness.origin}/`);
    await page.getByText("Privacy", { exact: true }).click();
    await page.getByText("The server keeps nothing on disk.").waitFor();

    const hiddenPixels = await page.evaluate(() => {
      const body = document.querySelector("details[open] > div") as HTMLElement;
      return body.scrollHeight - body.clientHeight;
    });
    expect(hiddenPixels).toBe(0);

    await context.close();
  });

  test("a click outside the note or Escape closes it", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const notice = page.getByText("The server keeps nothing on disk.");

    await page.getByText("Privacy", { exact: true }).click();
    await notice.waitFor();
    await page.mouse.click(640, 100);
    expect(await notice.isVisible()).toBe(false);

    await page.getByText("Privacy", { exact: true }).click();
    await notice.waitFor();
    await page.keyboard.press("Escape");
    expect(await notice.isVisible()).toBe(false);

    await context.close();
  });
});
