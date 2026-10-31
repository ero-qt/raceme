import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { Page } from "playwright";
import { type Harness, newPage, openLobbyAndEnter, startHarness } from "./harness.ts";

const axeSource = await Bun.file(
  join(import.meta.dir, "..", "node_modules", "axe-core", "axe.min.js"),
).text();
// Every WCAG level up to AA for 2.0, 2.1 and 2.2, plus axe's best practices.
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(() => harness.close());

/**
 * Runs axe-core on the page and returns each violation as `rule: target`. Contrast checks axe
 * could not decide count too, because they usually mean something covers the text.
 */
async function violations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(
    (tags) =>
      (window as unknown as { axe: { run(o: object): Promise<AxeResults> } }).axe.run({
        runOnly: { type: "tag", values: tags },
      }),
    wcagTags,
  );
  const undecidedContrast = results.incomplete.filter((r) => r.id === "color-contrast");
  return [...results.violations, ...undecidedContrast].flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
  );
}

interface AxeResults {
  violations: { id: string; nodes: { target: string[] }[] }[];
  incomplete: { id: string; nodes: { target: string[] }[] }[];
}

describe("axe-core WCAG 2.2 AA", () => {
  // Bypasses the CSP only here because axe gets injected as an inline script, which the CSP blocks.
  test("start page", async () => {
    const { context, page } = await newPage(harness, { bypassCSP: true });
    await page.goto(`${harness.origin}/`);
    // axe can't rate the contrast of an empty field, so it gets a goal typed in first.
    await page.getByLabel("goal or room code").fill("sm64 16 star");

    expect(await violations(page)).toEqual([]);

    await context.close();
  });

  test("start page with each footer note open", async () => {
    const { context, page } = await newPage(harness, { bypassCSP: true });
    await page.goto(`${harness.origin}/`);
    await page.getByText("privacy", { exact: true }).click();
    await page.getByText("raceme doesn't save anything about you.", { exact: false }).waitFor();

    expect(await violations(page)).toEqual([]);

    await page.getByText("build", { exact: true }).click();
    await page.getByText(/unverified build/).waitFor();

    expect(await violations(page)).toEqual([]);

    await context.close();
  });

  test("start page with suggestions and a category picked", async () => {
    const { context, page } = await newPage(harness, { bypassCSP: true });
    await page.goto(`${harness.origin}/`);
    await page.getByLabel("goal or room code").fill("mario 64");
    await page.getByRole("option", { name: /^speedrun\.com/ }).click();
    await page.getByRole("option", { name: "Super Mario 64", exact: true }).waitFor();

    expect(await violations(page)).toEqual([]);

    await page.getByRole("option", { name: "Super Mario 64", exact: true }).click();
    await page.getByRole("combobox", { name: "category" }).selectOption("16 Star");

    expect(await violations(page)).toEqual([]);

    await context.close();
  });

  test("room nobody has entered yet", async () => {
    const { context, page } = await newPage(harness, { bypassCSP: true });
    await page.goto(`${harness.origin}/`);
    await page.getByLabel("goal or room code").fill("sm64 16 star");
    await page.getByRole("button", { name: ".startrace" }).click();
    await page.getByLabel("your name").waitFor();

    expect(await violations(page)).toEqual([]);

    await context.close();
  });

  test("room before, during and after a race", async () => {
    const { context, page } = await newPage(harness, { bypassCSP: true });
    await openLobbyAndEnter(page, harness.origin, "ero");

    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { name: ".ready" }).click();
    await page.getByRole("button", { name: ".done" }).waitFor({ timeout: 10_000 });

    expect(await violations(page)).toEqual([]);

    await page.waitForTimeout(5_200);
    await page.getByRole("button", { name: ".done" }).click();
    await page.getByText("complete").waitFor();

    expect(await violations(page)).toEqual([]);

    await context.close();
  }, 30_000);
});
