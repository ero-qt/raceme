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
  const box = async (name: string, selector: string) => {
    const rect = await page.locator(selector).first().boundingBox();
    if (!rect) {
      throw new Error(`no box for ${name}`);
    }
    return [rect.x, rect.y, rect.width].map(Math.round);
  };

  return {
    title: await box("title", "h2"),
    count: await box("count", "h2 + span"),
    status: await box("status", "h2 ~ span >> nth=2"),
    nameColumn: await box("nameColumn", "th >> text=Name"),
    statusColumn: await box("statusColumn", "th >> text=Status"),
    timeColumn: await box("timeColumn", "th >> text=Time"),
    chat: await box("chat", "[aria-label='Chat']"),
    clock: await box("clock", "[role='timer']"),
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
