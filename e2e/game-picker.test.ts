import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Harness, newPage, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(() => harness.close());

describe("game picker", () => {
  test("a picked game and category become the room's goal", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);

    await page.getByLabel("goal or room code").fill("mario 64");
    await page.getByRole("option", { name: /^speedrun\.com/ }).click();
    await page.getByRole("option", { name: "Super Mario 64", exact: true }).click();
    await page.getByRole("combobox", { name: "category" }).selectOption("16 Star");
    await page.getByRole("button", { name: ".startrace" }).click();

    await page.getByLabel("your name").waitFor();
    expect(await page.title()).toBe("Super Mario 64 - 16 Star · raceme");

    await context.close();
  }, 20_000);

  test("an opened goal comes back under your goals", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    await page.getByLabel("goal or room code").fill("bingo blackout");
    await page.getByRole("button", { name: ".startrace" }).click();
    await page.getByLabel("your name").waitFor();

    await page.goto(`${harness.origin}/`);
    await page.getByLabel("goal or room code").fill("bingo");

    const pastGoal = page
      .getByRole("group", { name: "your goals" })
      .getByRole("option", { name: "bingo blackout" });
    await pastGoal.waitFor();
    expect(await pastGoal.count()).toBe(1);

    await context.close();
  }, 20_000);
});
