import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { Suspense } from "solid-js";
import { HomePage } from "./home-page.tsx";

const realFetch = globalThis.fetch;
afterEach(() => {
  setSystemTime();
  globalThis.fetch = realFetch;
  localStorage.clear();
  cleanup();
});

function acceptRooms() {
  const fetchMock = mock(async () => Response.json({ slug: "duxanagxds" }, { status: 201 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return () => {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body)).goal as string;
  };
}

const games = [
  { id: "o1y9wo6q", name: "Super Mario 64" },
  { id: "9d3rnedl", name: "Super Mario 64 DS" },
];
const categories = [
  { id: "7dgrrxk4", name: "120 Star" },
  { id: "n2y55mko", name: "16 Star" },
];

function renderHome(
  existing: string[] = ["duxanagxds"],
  options: {
    checkDelayMs?: number;
    checkFails?: boolean;
    games?: typeof games;
    categories?: typeof categories;
    /** Never answers searches for this text, like a lookup that hangs. */
    slowQuery?: string;
  } = {},
) {
  const opened: string[] = [];
  const searched: string[] = [];
  const view = render(() => (
    <HomePage
      loadStatus={async () => null}
      open={(slug) => opened.push(slug)}
      roomExists={async (slug) => {
        if (options.checkFails) {
          throw new Error("offline");
        }
        return existing.includes(slug);
      }}
      checkDelayMs={options.checkDelayMs ?? 0}
      searchGames={async (query) => {
        searched.push(query);
        if (query === options.slowQuery) {
          return new Promise(() => {});
        }
        const known = options.games ?? games;
        return known.filter((game) => game.name.toLowerCase().includes(query.toLowerCase()));
      }}
      loadCategories={async () => options.categories ?? categories}
      searchDelayMs={0}
    />
  ));
  const field = view.getByLabelText("goal or room code") as HTMLInputElement;
  const type = (value: string) => fireEvent.input(field, { target: { value } });
  const submit = () => fireEvent.submit(field.closest("form") as HTMLFormElement);
  // speedrun.com starts folded, so its header has to be opened before it searches.
  const unfoldSpeedrun = () =>
    fireEvent.click(view.getByRole("option", { name: /^speedrun\.com/ }));
  return { ...view, opened, searched, field, type, submit, unfoldSpeedrun };
}

describe("HomePage", () => {
  test("can open with a notice, like a room that closed", () => {
    const view = render(() => <HomePage notice="this room has closed." />);

    expect(view.getByRole("status").textContent).toBe("this room has closed.");
    expect(view.getByLabelText("goal or room code")).toBeTruthy();
  });

  test("one field at the top, .startrace greyed out while empty", () => {
    const home = renderHome();

    expect(home.field.placeholder).toBe("set goal or paste code");
    expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  test("a goal opens a lobby with it", async () => {
    const fetchMock = mock(async () => Response.json({ slug: "duxanagxds" }, { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const home = renderHome();
    home.type("any%");
    home.submit();
    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(JSON.parse(String(init.body))).toEqual({ goal: "any%" });
  });

  test("a pasted code of a live room is recognized, masked and joins", async () => {
    const home = renderHome();
    home.type("DUXANAGXDS");
    await waitFor(() => expect(home.getByRole("button", { name: "join" })).toBeTruthy());
    expect(home.queryByRole("button", { name: ".startrace" })).toBeNull();
    expect(home.field.dataset.kind).toBe("code");

    home.submit();
    expect(home.opened).toEqual(["duxanagxds"]);
  });

  test("a pasted invite link joins too", async () => {
    const home = renderHome();
    home.type("https://ero-qt.eu/apps/raceme/duxanagxds");
    await waitFor(() => expect(home.getByRole("button", { name: "join" })).toBeTruthy());
    home.submit();

    expect(home.opened).toEqual(["duxanagxds"]);
  });

  // "glitchless" has the shape of a room code, but no such room exists, so it stays a goal.
  test("hides a pasted code or link right away, before the room check answers", () => {
    const home = renderHome(["duxanagxds"], { checkDelayMs: 60_000 });

    fireEvent.paste(home.field);
    home.type("duxanagxds");
    expect(home.field.dataset.kind).toBe("code");

    fireEvent.paste(home.field);
    home.type("https://example.com/duxanagxds");
    expect(home.field.dataset.kind).toBe("code");
  });

  test("a code-shaped goal stays a goal when no such room exists", async () => {
    const home = renderHome([]);
    home.type("glitchless");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(home.getByRole("button", { name: ".startrace" })).toBeTruthy();
    expect(home.field.dataset.kind).toBe("goal");
  });

  test("Enter right after pasting a code waits for the check, not opening a lobby", async () => {
    globalThis.fetch = mock(async () => Response.json({ slug: "x" }, { status: 201 })) as never;
    const home = renderHome(["duxanagxds"], { checkDelayMs: 10_000 });
    home.type("https://ero-qt.eu/apps/raceme/duxanagxds");
    home.submit();
    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("a failed check says so instead of opening a lobby named after the code", async () => {
    const fetchMock = mock(async () => Response.json({ slug: "x" }, { status: 201 }));
    globalThis.fetch = fetchMock as never;
    const home = renderHome([], { checkFails: true });
    home.type("duxanagxds");
    home.submit();
    await waitFor(() =>
      expect(home.getByRole("status").textContent).toBe(
        "couldn't check that room code. try again.",
      ),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(home.opened).toEqual([]);
  });

  test("a refused goal says why", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 400 })) as unknown as typeof fetch;
    const home = renderHome();
    home.type("x");
    home.submit();
    await waitFor(() =>
      expect(home.getByRole("status").textContent).toBe(
        "the goal needs to be 1-200 characters long.",
      ),
    );
  });

  test("an unreachable server frees .startrace again and says so", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const home = renderHome();
    home.type("any%");

    home.submit();

    await waitFor(() => expect(home.getByRole("status").textContent).toBe("couldn't open a room."));
    expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("HomePage odd replies", () => {
  for (const status of [201, 428]) {
    test(`a ${status} reply that isn't JSON frees .startrace again`, async () => {
      globalThis.fetch = (async () =>
        new Response("<html>bad gateway</html>", { status })) as unknown as typeof fetch;
      const home = renderHome();
      home.type("any%");

      home.submit();

      await waitFor(() =>
        expect(home.getByRole("status").textContent).toBe("couldn't open a room."),
      );
      expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect(localStorage.getItem("raceme.goalHistory")).toBeNull();
    });
  }
});

describe("HomePage busy server", () => {
  test("solves the proof of work the server asks for during a rush, then opens the room", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? Response.json({ challenge: { token: "abc.1.sig", bits: 4 } }, { status: 428 })
        : Response.json({ slug: "duxanagxds" }, { status: 201 });
    }) as unknown as typeof fetch;
    const home = renderHome();
    home.type("any%");

    home.submit();

    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    expect(bodies[1]).toMatchObject({ goal: "any%", proof: { token: "abc.1.sig" } });
  });

  test("tells the visitor the rush makes opening a room slower", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { challenge: { token: "abc.1.sig", bits: 4 } },
        { status: 428 },
      )) as unknown as typeof fetch;
    // Hashing that never finishes holds the page in the middle of solving.
    const realSubtle = crypto.subtle;
    Object.defineProperty(crypto, "subtle", {
      value: { digest: () => new Promise(() => {}) },
      configurable: true,
    });
    const home = renderHome();
    home.type("any%");

    home.submit();

    await waitFor(() =>
      expect(home.getByRole("status").textContent).toBe(
        "lots of rooms are being opened right now. please wait a few seconds…",
      ),
    );
    Object.defineProperty(crypto, "subtle", { value: realSubtle, configurable: true });
  });
});

describe("HomePage busy server, no WebCrypto", () => {
  // Browsers only offer crypto.subtle on https pages, so a plain http page can't solve the puzzle.
  test("says it couldn't check the browser instead of hanging", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { challenge: { token: "abc.1.sig", bits: 4 } },
        { status: 428 },
      )) as unknown as typeof fetch;
    const realSubtle = crypto.subtle;
    Object.defineProperty(crypto, "subtle", { value: undefined, configurable: true });
    const home = renderHome();
    home.type("any%");

    home.submit();

    await waitFor(() => expect(home.getByRole("status").textContent).toBe("couldn't open a room."));
    expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    Object.defineProperty(crypto, "subtle", { value: realSubtle, configurable: true });
  });
});

describe("HomePage suggestions", () => {
  test("typing a game name lists speedrun.com games", async () => {
    const home = renderHome();
    home.type("mario");

    home.unfoldSpeedrun();

    await waitFor(() => expect(home.getByRole("option", { name: "Super Mario 64" })).toBeTruthy());
  });

  test("a picked game offers its categories and the goal joins both", async () => {
    const goalSent = acceptRooms();
    const home = renderHome();
    home.type("mario");
    home.unfoldSpeedrun();
    await waitFor(() => home.getByRole("option", { name: "Super Mario 64" }));

    fireEvent.click(home.getByRole("option", { name: "Super Mario 64" }));
    const category = (await waitFor(() =>
      home.getByRole("combobox", { name: "category" }),
    )) as HTMLSelectElement;
    fireEvent.change(category, { target: { value: "16 Star" } });
    home.submit();

    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    expect(home.field.value).toBe("Super Mario 64");
    expect(goalSent()).toBe("Super Mario 64 - 16 Star");
  });

  test("editing the field after picking a game drops the category", async () => {
    const home = renderHome();
    home.type("mario");
    home.unfoldSpeedrun();
    await waitFor(() => home.getByRole("option", { name: "Super Mario 64" }));
    fireEvent.click(home.getByRole("option", { name: "Super Mario 64" }));
    await waitFor(() => home.getByRole("combobox", { name: "category" }));

    home.type("Super Mario 64 any%");

    expect(home.queryByRole("combobox", { name: "category" })).toBeNull();
  });

  test("an opened room's goal shows under your goals next time", async () => {
    const goalSent = acceptRooms();
    const first = renderHome();
    first.type("sm64 70 star");
    first.submit();
    await waitFor(() => expect(first.opened).toEqual(["duxanagxds"]));
    expect(goalSent()).toBe("sm64 70 star");
    cleanup();

    const home = renderHome();
    home.type("sm64");

    await waitFor(() => expect(home.getByRole("group", { name: "your goals" })).toBeTruthy());
    expect(home.getByRole("option", { name: "sm64 70 star" })).toBeTruthy();
  });

  test("the × removes a past goal for good", async () => {
    localStorage.setItem("raceme.goalHistory", JSON.stringify(["sm64 70 star"]));
    const home = renderHome();
    home.type("sm64");
    await waitFor(() => home.getByRole("option", { name: "sm64 70 star" }));

    fireEvent.click(home.getByTitle("remove from your goals"));

    expect(home.queryByRole("option", { name: "sm64 70 star" })).toBeNull();
    expect(localStorage.getItem("raceme.goalHistory")).toBeNull();
  });

  test("speedrun.com starts folded and asks nothing until it's opened", async () => {
    const home = renderHome();
    home.type("mario");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(home.searched).toEqual([]);

    home.unfoldSpeedrun();

    await waitFor(() => expect(home.searched).toEqual(["mario"]));
  });

  // A pasted room code must never reach speedrun.com, however the link was copied.
  test("never searches speedrun.com for a room code", async () => {
    const home = renderHome();
    home.type("mario");
    home.unfoldSpeedrun();
    await waitFor(() => expect(home.searched).toEqual(["mario"]));

    for (const text of [
      "https://ero-qt.eu/apps/raceme/duxanagxds",
      "https://ero-qt.eu/apps/raceme/duxanagxds/",
      "https://ero-qt.eu/apps/raceme/duxanagxds?from=chat",
      "duxanagxds.",
    ]) {
      home.type(text);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(home.searched).toEqual(["mario"]);
  });

  // "bloodborne" has the shape of a room code, but no room has that code.
  test("searches a code-shaped word once the check finds no such room", async () => {
    const home = renderHome([]);
    home.type("mario");
    home.unfoldSpeedrun();

    home.type("bloodborne");

    await waitFor(() => expect(home.searched).toContain("bloodborne"));
  });

  test("keeps the old games up while new text is still being looked up", async () => {
    const home = renderHome(["duxanagxds"], { slowQuery: "zelda" });
    home.type("mario");
    home.unfoldSpeedrun();
    await waitFor(() => home.getByRole("option", { name: "Super Mario 64" }));

    home.type("zelda");

    expect(home.getByRole("option", { name: "Super Mario 64" })).toBeTruthy();
  });

  test("keeps the joined goal within the 200 characters a room allows", async () => {
    const goalSent = acceptRooms();
    const long = { id: "o1y9wo6q", name: "G".repeat(100) };
    const home = renderHome(["duxanagxds"], {
      games: [long],
      categories: [{ id: "n2y55mko", name: "C".repeat(100) }],
    });
    home.type("ggg");
    home.unfoldSpeedrun();
    fireEvent.click(await waitFor(() => home.getByRole("option", { name: long.name })));
    const category = (await waitFor(() =>
      home.getByRole("combobox", { name: "category" }),
    )) as HTMLSelectElement;
    fireEvent.change(category, { target: { value: "C".repeat(100) } });

    home.submit();

    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    expect(goalSent()).toHaveLength(200);
  });

  test("clicking the empty field lists recent goals", async () => {
    localStorage.setItem("raceme.goalHistory", JSON.stringify(["sm64 70 star", "oot any%"]));
    const home = renderHome();

    fireEvent.click(home.field);

    expect(home.getByRole("group", { name: "your goals" })).toBeTruthy();
    expect(home.getByRole("option", { name: "oot any%" })).toBeTruthy();
  });

  test("your own text is always the last of your goals, to show any goal works", async () => {
    const goalSent = acceptRooms();
    const home = renderHome();
    home.type("bingo blackout");

    const typed = home.getByRole("option", { name: "use bingo blackout as the goal" });
    fireEvent.click(typed);
    home.submit();

    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    expect(goalSent()).toBe("bingo blackout");
  });

  test("leaves out your own text when it's already one of your goals", () => {
    localStorage.setItem("raceme.goalHistory", JSON.stringify(["sm64 70 star"]));
    const home = renderHome();

    home.type("sm64 70 star");

    expect(home.queryByRole("option", { name: /^use / })).toBeNull();
  });

  test("asks for each search text once per page, so going back a letter costs nothing", async () => {
    const home = renderHome();
    home.type("m");
    home.unfoldSpeedrun();

    for (const text of ["mario", "mari", "mario"]) {
      home.type(text);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(home.searched).toEqual(["mario", "mari"]);
  });
});

describe("HomePage intro", () => {
  test("tells what raceme is beside the start form, with a note that rooms get deleted", () => {
    const home = renderHome();

    expect(home.getByRole("heading", { name: "welcome" })).toBeTruthy();
    const intro = home.getByRole("complementary").textContent;
    expect(intro).toContain("without accounts and without moderation");
    expect(intro).toContain("a room is deleted from the server once it closes.");
    expect(home.getByRole("link", { name: "SRL" }).getAttribute("href")).toBe(
      "https://speedrunslive.com",
    );
  });
});

describe("HomePage server status", () => {
  test("shows how many rooms are open and people are online", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ rooms: 3, people: 7, restartAt: null }),
    ) as unknown as typeof fetch;
    const view = render(() => <HomePage />);

    expect((await view.findByText(/^7 online/)).textContent).toBe("7 online3 rooms open");
    expect(view.getByRole("heading", { name: "server status" })).toBeTruthy();
  });

  test("keeps the page and focus up while the status polls again", async () => {
    let polls = 0;
    const loadStatus = () =>
      new Promise<{ rooms: number; people: number; restartAt: null }>((resolve) => {
        polls++;
        setTimeout(() => resolve({ rooms: polls, people: 0, restartAt: null }), 20);
      });
    const view = render(() => (
      <Suspense fallback={<p>loading</p>}>
        <HomePage loadStatus={loadStatus} statusEveryMs={30} />
      </Suspense>
    ));
    const field = await view.findByLabelText("goal or room code");
    field.focus();

    await waitFor(() => expect(polls).toBeGreaterThanOrEqual(3));
    const card = view.getByRole("heading", { name: "server status" }).parentElement;
    await waitFor(() => expect(card?.textContent).toMatch(/[3-9]\d* rooms open$/));

    expect(view.getByLabelText("goal or room code")).toBe(field);
    expect(document.activeElement).toBe(field);
  });

  test("shows the start field while the server status is still on its way", () => {
    const view = render(() => (
      <Suspense fallback={<p>loading</p>}>
        <HomePage loadStatus={() => new Promise(() => {})} />
      </Suspense>
    ));

    expect(view.getByLabelText("goal or room code")).toBeTruthy();
    const card = view.getByRole("heading", { name: "server status" }).parentElement;
    expect(card?.textContent).toBe("server status loading");
    expect(card?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  test("counts 1 room in the singular", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ rooms: 1, people: 1, restartAt: null }),
    ) as unknown as typeof fetch;
    const view = render(() => <HomePage />);

    expect((await view.findByText(/^1 online/)).textContent).toBe("1 online1 room open");
  });
});

describe("HomePage restart notice", () => {
  test("shows a queued server restart in the server status card", async () => {
    const restartAt = Date.now() + (3 * 60 + 20) * 60_000 + 30_000;
    globalThis.fetch = mock(async () =>
      Response.json({ rooms: 2, people: 5, restartAt }),
    ) as unknown as typeof fetch;
    const view = render(() => <HomePage />);

    const text = new Date(restartAt).toISOString().slice(11, 16);
    const notice = (await view.findByText(/^all rooms will be closed/)).closest("p");
    expect(notice?.textContent).toBe(
      `all rooms will be closed for a server restart at ${text} UTC (in 3 h 20 min)!`,
    );
    // Uses the red of the other notices and the warning sign of the closed room.
    expect(notice?.className).toContain(view.getByRole("status").className);
    expect(notice?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(notice?.parentElement).toBe(
      view.getByRole("heading", { name: "server status" }).parentElement,
    );
  });

  test("counts down while the page stays open", async () => {
    const start = Date.now();
    const restartAt = start + (3 * 60 + 20) * 60_000 + 30_000;
    const view = render(() => (
      <HomePage loadStatus={async () => ({ rooms: 1, people: 1, restartAt })} statusEveryMs={10} />
    ));
    await view.findByText(/in 3 h 20 min/);

    setSystemTime(new Date(start + 10 * 60_000));

    expect(await view.findByText(/in 3 h 10 min/)).toBeTruthy();
  });
});
