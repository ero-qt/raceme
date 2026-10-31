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
    status: await box(
      "status",
      "[aria-label='chat'] span",
      /^(entry|starting|in progress|complete|terminated)/,
    ),
    nameColumn: await box("nameColumn", "th >> text=name"),
    statusColumn: await box("statusColumn", "th >> text=status"),
    timeColumn: await box("timeColumn", "th >> text=time"),
    chat: await box("chat", "[aria-label='chat']"),
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
    await guest.page.getByLabel("your name").fill("guest");
    await guest.page.getByRole("button", { name: ".enter" }).click();
    await host.page.getByText("2/").waitFor();
    const before = await positions(host.page);

    // Someone opening the room without entering changes the watcher count from 0 to 1.
    const watcher = await newPage(harness);
    await watcher.page.goto(host.page.url());
    await host.page.getByTitle("1 watching").waitFor();
    expect(await positions(host.page)).toEqual(before);
    await watcher.context.close();

    const limit = host.page.getByLabel("entrant limit");
    const setCap = async (cap: string) => {
      await limit.fill(cap);
      await limit.blur();
      await host.page.waitForFunction(
        (want) =>
          (document.querySelector("[aria-label='entrant limit']") as HTMLInputElement).value ===
          want,
        cap,
      );
    };
    await setCap("8");
    await setCap("300");
    expect(await positions(host.page)).toEqual(before);

    await setCap("8");
    expect(await positions(host.page)).toEqual(before);

    await host.page.getByRole("button", { name: ".ready" }).click();
    await guest.page.getByRole("button", { name: ".ready" }).click();
    await host.page.getByText("starting").waitFor();
    expect(await positions(host.page)).toEqual(before);

    await host.page.getByText("in progress").waitFor();
    expect(await positions(host.page)).toEqual(before);

    // A row button is as wide as its text, at the end of its column, which stays as wide as
    // `.unenter`, the widest of them.
    const quit = await host.page.getByRole("button", { name: ".quit" }).boundingBox();
    const quitCell = await host.page
      .getByRole("button", { name: ".quit" })
      .locator("xpath=..")
      .boundingBox();
    // A button's side padding is the page's 8px spacing, inside its 2px border.
    const quitPadding = await host.page
      .getByRole("button", { name: ".quit" })
      .evaluate((button) => {
        const range = document.createRange();
        range.selectNodeContents(button);
        return (button.getBoundingClientRect().width - range.getBoundingClientRect().width - 4) / 2;
      });
    expect(Math.round(quitPadding)).toBe(8);
    expect({
      narrowerThanCell: (quit?.width ?? 0) < (quitCell?.width ?? 0) - 24,
      atTheEnd:
        Math.round((quit?.x ?? 0) + (quit?.width ?? 0)) ===
        Math.round((quitCell?.x ?? 0) + (quitCell?.width ?? 0) - 8),
    }).toEqual({ narrowerThanCell: true, atTheEnd: true });

    // A finished time with every digit fits the time column. On phones it fits the status column.
    await host.page.getByLabel("time precision").selectOption("3");
    await host.page.getByRole("button", { name: ".done" }).click({ timeout: 10_000 });
    await host.page.getByRole("columnheader", { name: "#" }).waitFor();
    await host.page
      .getByText(/^\d\d:\d\d:\d\d\.\d\d\d$/)
      .first()
      .waitFor();
    expect(await positions(host.page)).toEqual(before);

    // `send` is a square, so it takes as little of the line as a button can.
    const sendBox = await guest.page.getByRole("button", { name: "send" }).boundingBox();
    expect([Math.round(sendBox?.width ?? 0), Math.round(sendBox?.height ?? 0)]).toEqual([32, 32]);
    // The box, `send` and the race buttons share one line even on a narrow screen.
    await guest.page.setViewportSize({ width: 320, height: 800 });
    await guest.page.getByRole("button", { name: "chat", exact: true }).click();
    const [box, send, done] = await Promise.all(
      [guest.page.getByLabel("message"), guest.page.getByRole("button", { name: "send" })]
        .map((control) => control.boundingBox())
        .concat([guest.page.getByRole("button", { name: ".done" }).boundingBox()]),
    );
    expect({
      boxWide: (box?.width ?? 0) >= 100,
      sendBeside: Math.round(send?.y ?? 0) === Math.round(box?.y ?? 1),
      doneBeside: Math.round(done?.y ?? 0) === Math.round(box?.y ?? 1),
    }).toEqual({ boxWide: true, sendBeside: true, doneBeside: true });

    await host.context.close();
    await guest.context.close();
  }, 30_000);
});

describe("room columns", () => {
  test("the room details take the wide left column and the chat the right, tabs on phones", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "ero");
    const race = page.getByRole("region", { name: "room" });
    const chat = page.getByRole("region", { name: "chat" });

    const wideRace = await race.boundingBox();
    const wideChat = await chat.boundingBox();
    const main = await page.locator("main").boundingBox();
    expect({
      sideBySide: (wideChat?.x ?? 0) >= (wideRace?.x ?? 0) + (wideRace?.width ?? 0),
      raceWider: (wideRace?.width ?? 0) > (wideChat?.width ?? 0),
      // The chat runs down to the page's bottom padding, so the log gets the spare height.
      chatFillsHeight:
        (wideChat?.y ?? 0) + (wideChat?.height ?? 0) >= (main?.y ?? 0) + (main?.height ?? 0) - 17,
      noTabs: await page.getByRole("button", { name: "chat", exact: true }).isHidden(),
    }).toEqual({ sideBySide: true, raceWider: true, chatFillsHeight: true, noTabs: true });

    // Just past the phone breakpoint the chat column is narrow, with its controls still inside.
    await page.setViewportSize({ width: 1000, height: 800 });
    const narrowChat = await chat.boundingBox();
    const end = await page.getByRole("button", { name: ".end" }).boundingBox();
    const guest = await newPage(harness);
    await guest.page.setViewportSize({ width: 1000, height: 800 });
    await guest.page.goto(page.url());
    const name = await guest.page.getByLabel("your name").boundingBox();
    const enter = await guest.page.getByRole("button", { name: ".enter" }).boundingBox();
    await guest.context.close();
    expect({
      endInside:
        (end?.x ?? 0) + (end?.width ?? 0) <= (narrowChat?.x ?? 0) + (narrowChat?.width ?? 0),
      enterBesideName: Math.round(enter?.y ?? 0) === Math.round(name?.y ?? 1),
    }).toEqual({ endInside: true, enterBesideName: true });

    // The host entered after the room opened, so the chat with the join form is up first.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole("button", { name: "room", exact: true }).waitFor();
    expect([await race.isVisible(), await chat.isVisible()]).toEqual([false, true]);
    await page.getByRole("button", { name: "room", exact: true }).click();
    expect([await race.isVisible(), await chat.isVisible()]).toEqual([true, false]);
    // Each card has its own clock on a phone, so the room tab keeps the time in view.
    expect(await race.getByRole("timer").isVisible()).toBe(true);

    // The tab bar sticks to the bottom of the screen while the page is longer than it, and the
    // footer scrolls in right below the bar, never under it and with no gap.
    const bar = page.getByRole("navigation", { name: "room cards" });
    const footer = page.locator("footer");
    await page.setViewportSize({ width: 390, height: 300 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const stuck = await bar.boundingBox();
    expect(Math.round((stuck?.y ?? 0) + (stuck?.height ?? 0))).toBe(300);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const [atEnd, footerBox] = await Promise.all([bar.boundingBox(), footer.boundingBox()]);
    expect(Math.round((atEnd?.y ?? 0) + (atEnd?.height ?? 0))).toBe(Math.round(footerBox?.y ?? 0));
    // Focus scrolls a control up from under the stuck bar, which covers the screen's bottom.
    await page.setViewportSize({ width: 390, height: 220 });
    const lastButton = race.getByRole("button").last();
    await lastButton.evaluate((button) => {
      window.scrollTo(0, 0);
      window.scrollTo(0, button.getBoundingClientRect().top - window.innerHeight + 20);
    });
    await lastButton.focus();
    const focused = await lastButton.boundingBox();
    const shortBar = await bar.boundingBox();
    expect((focused?.y ?? 0) + (focused?.height ?? 0) <= (shortBar?.y ?? 0)).toBe(true);
    // The chat runs down to the bar on a short page too.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole("button", { name: "chat", exact: true }).click();
    const [chatBox, barBox] = await Promise.all([chat.boundingBox(), bar.boundingBox()]);
    expect(Math.round((chatBox?.y ?? 0) + (chatBox?.height ?? 0) + 16)).toBe(
      Math.round(barBox?.y ?? 0),
    );
    // A footer note opens over the bar, so its last lines stay readable and tappable.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.getByText("privacy", { exact: true }).click();
    const barTop = (await bar.boundingBox())?.y ?? 0;
    const noteCovered = await page.evaluate((barTop) => {
      const note = document.querySelector("details[open] > div") as HTMLElement;
      const rect = note.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, barTop + 10);
      return rect.bottom > barTop && !note.contains(hit);
    }, barTop);
    expect(noteCovered).toBe(false);

    await context.close();
  });
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

describe("entrants header on phones", () => {
  test("keeps the lock on the title's line on a 412 and a 390 pixel wide screen", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "ero");

    for (const width of [412, 390]) {
      await page.setViewportSize({ width, height: 800 });
      // Waits because Chromium applies the phone styles a moment after the resize.
      const onTitleLine = await page
        .waitForFunction(
          () => {
            const middle = (element: Element | null | undefined) => {
              const box = element?.getBoundingClientRect();
              return (box?.top ?? 0) + (box?.height ?? 0) / 2;
            };
            const title = document.querySelector("h2");
            const lock = title?.parentElement?.querySelector("button");
            return Math.abs(middle(title) - middle(lock)) <= 4;
          },
          undefined,
          { timeout: 2_000 },
        )
        .then(() => true)
        .catch(() => false);
      expect([width, onTitleLine]).toEqual([width, true]);
    }

    await context.close();
  });
});

describe("entrant table", () => {
  // The table keeps its time and button columns while it is wide enough to leave names 100
  // pixels: beside the chat from 976 pixels of screen, alone on a 700 pixel phone, not on a
  // 900 pixel screen where the chat takes its share. Otherwise a finished time takes the place
  // of the Done badge and the row buttons go under the name. The longest name with no space in
  // it wraps inside its cell instead of widening the table.
  test("leaves the host at least 100 pixels for names on a 976, 900, 700, 412 and 360 pixel wide screen", async () => {
    const { context, page } = await newPage(harness);
    await openLobbyAndEnter(page, harness.origin, "xXx_SpeedRunner_2026_xXx");

    for (const width of [976, 900, 700, 412, 360]) {
      await page.setViewportSize({ width, height: 800 });
      if (width < 768) {
        await page.getByRole("button", { name: "room", exact: true }).click();
      }
      await page
        .getByRole("columnheader", { name: "time" })
        .waitFor({ state: width >= 976 || width === 700 ? "visible" : "detached" });
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector("#app") as Element).minHeight === "800px",
      );
      const sizes = await page.evaluate(() => {
        const name = [...document.querySelectorAll("th")].find((th) => th.textContent === "name");
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

describe("page shell", () => {
  test("the header is a bar across the window above the content, the footer one below it", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);

    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector("#app") as Element).minHeight === "800px",
      );
      const boxes = await page.evaluate(() => {
        const box = (selector: string) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect
            ? [Math.round(rect.width), Math.round(rect.top), Math.round(rect.bottom)]
            : [];
        };
        return { header: box("header"), main: box("main"), footer: box("footer") };
      });
      const [headerWidth, , headerBottom] = boxes.header;
      const [, mainTop, mainBottom] = boxes.main;
      const [footerWidth, footerTop, footerBottom] = boxes.footer;
      expect({
        width,
        headerFills: headerWidth === width,
        headerTall: headerBottom !== undefined && headerBottom >= 44,
        mainBelowHeader:
          mainTop !== undefined && headerBottom !== undefined && mainTop >= headerBottom,
        footerFills: footerWidth === width,
        footerBelowMain:
          footerTop !== undefined && mainBottom !== undefined && footerTop >= mainBottom,
        footerOnScreen: footerBottom !== undefined && footerBottom <= 800,
      }).toEqual({
        width,
        headerFills: true,
        headerTall: true,
        mainBelowHeader: true,
        footerFills: true,
        footerBelowMain: true,
        footerOnScreen: true,
      });
    }

    await context.close();
  });
});

describe("control size", () => {
  // WCAG 2.2 AA asks for 24px targets. 32px keeps buttons easy to hit without the AAA bulk.
  test("buttons and fields are 32 pixels tall", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);

    const heights = await Promise.all(
      [page.getByRole("button", { name: ".startrace" }), page.getByLabel("goal or room code")].map(
        async (control) => Math.round((await control.boundingBox())?.height ?? 0),
      ),
    );
    expect(heights).toEqual([32, 32]);

    await context.close();
  });
});

describe("inline fields", () => {
  test("the start field shows only an underline, on hover and focus", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const clear = "rgba(0, 0, 0, 0)";
    const line = "rgb(138, 147, 163)";
    const field = page.getByLabel("goal or room code");
    const borders = () =>
      field.evaluate((node) => {
        const style = getComputedStyle(node);
        return [
          style.borderBottomColor,
          style.borderTopColor,
          style.borderLeftWidth,
          style.outlineStyle,
        ];
      });
    // The underline's color takes a frame to change, so the check gives it a few.
    const expectBorders = async (bottom: string) => {
      for (let tries = 0; (await borders())[0] !== bottom && tries < 20; tries++) {
        await page.waitForTimeout(50);
      }
      expect(await borders()).toEqual([bottom, clear, "0px", "none"]);
    };

    await expectBorders(clear);
    await field.hover();
    await expectBorders(line);
    await field.click();
    await page.mouse.move(0, 0);
    await expectBorders(line);

    await context.close();
  });
});

describe("home layout", () => {
  test("the start form takes the wide left column, the intro the right, right below it on phones", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const form = page.getByLabel("goal or room code");
    const intro = page.getByRole("complementary");

    await page.setViewportSize({ width: 1280, height: 800 });
    const wideForm = await form.boundingBox();
    const wideIntro = await intro.boundingBox();
    expect({
      sideBySide: (wideIntro?.x ?? 0) >= (wideForm?.x ?? 0) + (wideForm?.width ?? 0),
      formWider: (wideForm?.width ?? 0) > (wideIntro?.width ?? 0),
    }).toEqual({ sideBySide: true, formWider: true });

    await page.setViewportSize({ width: 390, height: 800 });
    const phoneForm = await form.boundingBox();
    if (!phoneForm) {
      throw new Error("the start field is missing");
    }
    const cards = await page.getByRole("complementary").locator("> section").all();
    const [welcome, status] = await Promise.all(cards.map((card) => card.boundingBox()));
    if (!welcome || !status) {
      throw new Error("the welcome or the status card is missing");
    }
    // The field lines up with the cards, and the gap below it is the gap between the cards.
    expect(Math.round(phoneForm.x)).toBe(Math.round(welcome.x));
    expect(Math.round(welcome.y - phoneForm.y - phoneForm.height)).toBe(
      Math.round(status.y - welcome.y - welcome.height),
    );

    await context.close();
  });

  test("the start form stays put when a footer note opens", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const form = page.getByLabel("goal or room code");
    const before = await form.boundingBox();

    await page.getByText("privacy", { exact: true }).click();
    await page.getByText("raceme doesn't save anything about you.", { exact: false }).waitFor();
    expect(await form.boundingBox()).toEqual(before);

    await page.getByText("build", { exact: true }).click();
    await page.getByText(/unverified build/).waitFor();
    expect(await form.boundingBox()).toEqual(before);

    await context.close();
  });

  test("the footer note summaries stay put when a note opens above them", async () => {
    const { context, page } = await newPage(harness);
    await page.goto(`${harness.origin}/`);
    const summaries = page.locator("summary");
    const boxes = async () =>
      Promise.all((await summaries.all()).map(async (summary) => await summary.boundingBox()));
    const before = await boxes();

    await page.getByText("privacy", { exact: true }).click();
    const notice = page.getByText("raceme doesn't save anything about you.", { exact: false });
    await notice.waitFor();
    expect(await boxes()).toEqual(before);
    expect(((await notice.boundingBox())?.y ?? 0) < (before[0]?.y ?? 0)).toBe(true);

    // Opening the other note closes this one, so 2 notes never cover each other.
    await page.getByText("build", { exact: true }).click();
    await page.getByText(/unverified build/).waitFor();
    expect(await notice.isVisible()).toBe(false);
    expect(await boxes()).toEqual(before);

    await context.close();
  });

  test("an open note uses the height above the summaries before it scrolls", async () => {
    const { context, page } = await newPage(harness);
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`${harness.origin}/`);
    await page.getByText("privacy", { exact: true }).click();
    await page.getByText("raceme doesn't save anything about you.", { exact: false }).waitFor();

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
    const notice = page.getByText("raceme doesn't save anything about you.", { exact: false });

    await page.getByText("privacy", { exact: true }).click();
    await notice.waitFor();
    await page.mouse.click(640, 100);
    expect(await notice.isVisible()).toBe(false);

    await page.getByText("privacy", { exact: true }).click();
    await notice.waitFor();
    await page.keyboard.press("Escape");
    expect(await notice.isVisible()).toBe(false);

    await context.close();
  });
});
