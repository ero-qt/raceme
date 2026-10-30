import { describe, expect, test } from "bun:test";
import { SpeedrunCatalog } from "./speedrun.ts";

const apiUrl = "https://src.test/api";

const sm64 = {
  id: "o1y9wo6q",
  names: { international: "Super Mario 64", japanese: null },
  abbreviation: "sm64",
};

/** Answers like the speedrun.com v1 API and records every request it gets. */
function fakeApi(routes: Record<string, unknown>) {
  const requests: Request[] = [];
  const fetchFake = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    const body = routes[`${url.pathname}${url.search}`];
    return body === undefined ? new Response(null, { status: 404 }) : Response.json(body);
  };
  return { requests, fetch: fetchFake as typeof fetch };
}

function catalog(api: ReturnType<typeof fakeApi>, now = () => 0) {
  return new SpeedrunCatalog({ apiUrl, fetch: api.fetch, clock: now, perMinute: 60 });
}

const searchPath = "/api/v1/games?name=super+mario+64&max=50&_bulk=yes";
const categoriesPath = "/api/v1/games/o1y9wo6q/categories";

describe("SpeedrunCatalog.searchGames", () => {
  test("returns only ids and names", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });

    const games = await catalog(api).searchGames("Super Mario 64");

    expect(games).toEqual([{ id: "o1y9wo6q", name: "Super Mario 64" }]);
  });

  // speedrun.com asks API clients to name themselves.
  test("sends a User-Agent that names raceme", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });

    await catalog(api).searchGames("super mario 64");

    expect(api.requests[0]?.headers.get("user-agent")).toStartWith("raceme");
  });

  test("asks speedrun.com once for the same search, however it's typed", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });
    const games = catalog(api);

    await games.searchGames("super mario 64");
    const asked = api.requests.length;
    await games.searchGames("  Super   MARIO 64 ");

    expect(api.requests).toHaveLength(asked);
  });

  test("asks again once the cached answer is an hour old", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });
    let now = 0;
    const games = catalog(api, () => now);

    await games.searchGames("super mario 64");
    const asked = api.requests.length;
    now = 60 * 60_000 + 1;
    await games.searchGames("super mario 64");

    expect(api.requests).toHaveLength(2 * asked);
  });

  test("forgets an expired search once the next lookup comes in", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });
    let now = 0;
    const games = catalog(api, () => now);
    await games.searchGames("Super Mario 64");
    expect(games.cachedCount).toBe(1);

    now = 60 * 60_000 + 1;
    await games.categories("o1y9wo6q");

    expect(games.cachedCount).toBe(0);
  });

  test("skips searches too short to narrow anything down", async () => {
    const api = fakeApi({});

    expect(await catalog(api).searchGames("s")).toEqual([]);
    expect(api.requests).toHaveLength(0);
  });

  test("cleans names and drops entries that don't look like games", async () => {
    const odd = [
      { id: "o1y9wo6q", names: { international: "Super‮ Mario 64" } },
      { id: "../admin", names: { international: "Evil" } },
      { id: "abcd1234" },
      "not a game",
    ];
    const api = fakeApi({ [searchPath]: { data: odd } });

    expect(await catalog(api).searchGames("super mario 64")).toEqual([
      { id: "o1y9wo6q", name: "Super Mario 64" },
    ]);
  });

  test("says unavailable when speedrun.com fails, without caching the failure", async () => {
    const api = fakeApi({});
    const games = catalog(api);

    expect(await games.searchGames("super mario 64")).toBe("unavailable");
    const asked = api.requests.length;
    expect(await games.searchGames("super mario 64")).toBe("unavailable");
    expect(api.requests.length).toBeGreaterThan(asked);
  });

  // Keeps raceme from putting an unreasonable load on speedrun.com, as its terms ask.
  test("stops asking speedrun.com once the server-wide budget is spent", async () => {
    const api = fakeApi({});
    const games = new SpeedrunCatalog({ apiUrl, fetch: api.fetch, clock: () => 0, perMinute: 2 });

    for (const query of ["aa", "bb", "cc"]) {
      await games.searchGames(query);
    }

    expect(api.requests).toHaveLength(2);
  });
});

/** Builds the v2 search path the way speedrun.com's own site does, url-safe base64 of the JSON. */
function siteSearchPath(query: string): string {
  const params = { query, includeGames: true, limit: 10 };
  return `/api/v2/GetSearch?_r=${Buffer.from(JSON.stringify(params)).toString("base64url")}`;
}

describe("SpeedrunCatalog.searchGames site search", () => {
  const minecraft = [
    { id: "k6q474zd", name: "Minecraft (Classic)", url: "mcc" },
    { id: "j1npme6p", name: "Minecraft: Java Edition", url: "mc" },
  ];

  test("uses speedrun.com's own site search and keeps its order", async () => {
    const api = fakeApi({ [siteSearchPath("minecraft")]: { gameList: minecraft } });

    const games = await catalog(api).searchGames("Minecraft");

    expect(games).toEqual([
      { id: "k6q474zd", name: "Minecraft (Classic)" },
      { id: "j1npme6p", name: "Minecraft: Java Edition" },
    ]);
    expect(api.requests).toHaveLength(1);
  });

  test("falls back to the v1 search when the site search fails", async () => {
    const api = fakeApi({ [searchPath]: { data: [sm64] } });

    const games = await catalog(api).searchGames("super mario 64");

    expect(games).toEqual([{ id: "o1y9wo6q", name: "Super Mario 64" }]);
  });

  test("falls back when the site search answers in a shape it doesn't know", async () => {
    const api = fakeApi({
      [siteSearchPath("super mario 64")]: { games: "changed" },
      [searchPath]: { data: [sm64] },
    });

    const games = await catalog(api).searchGames("super mario 64");

    expect(games).toEqual([{ id: "o1y9wo6q", name: "Super Mario 64" }]);
  });
});

describe("SpeedrunCatalog.searchGames site search rest", () => {
  test("skips the site search for 10 minutes after it fails", async () => {
    const api = fakeApi({});
    let now = 0;
    const games = catalog(api, () => now);
    const siteRequests = () => api.requests.filter((r) => r.url.includes("/v2/")).length;

    await games.searchGames("aa");
    await games.searchGames("bb");
    expect(siteRequests()).toBe(1);

    now = 10 * 60_000;
    await games.searchGames("cc");
    expect(siteRequests()).toBe(2);
  });
});

describe("SpeedrunCatalog budget", () => {
  // Visitors draining the budget must not switch the site search off for everyone else.
  test("a spent budget doesn't pause the site search", async () => {
    const api = fakeApi({
      [siteSearchPath("aa")]: { gameList: [] },
      [siteSearchPath("cc")]: { gameList: [] },
    });
    let now = 0;
    const games = new SpeedrunCatalog({ apiUrl, fetch: api.fetch, clock: () => now, perMinute: 1 });

    await games.searchGames("aa");
    expect(await games.searchGames("bb")).toBe("unavailable");
    now = 60_000;
    await games.searchGames("cc");

    expect(api.requests.map((r) => new URL(r.url).pathname)).toEqual([
      "/api/v2/GetSearch",
      "/api/v2/GetSearch",
    ]);
  });

  test("shares one request between identical searches that arrive together", async () => {
    const api = fakeApi({ [siteSearchPath("mario")]: { gameList: [] } });
    const games = catalog(api);

    await Promise.all([games.searchGames("mario"), games.searchGames("Mario")]);

    expect(api.requests).toHaveLength(1);
  });
});

describe("SpeedrunCatalog.searchGames ranking", () => {
  const game = (id: string, name: string, abbreviation = id) => ({
    id,
    names: { international: name },
    abbreviation,
  });

  test("puts an exact abbreviation first", async () => {
    const api = fakeApi({
      "/api/v1/games?abbreviation=sm64&_bulk=yes": { data: [sm64] },
      "/api/v1/games?name=sm64&max=50&_bulk=yes": { data: [game("aaaa1111", "SM64 Hacks")] },
    });

    const games = await catalog(api).searchGames("SM64");

    expect(games).toEqual([
      { id: "o1y9wo6q", name: "Super Mario 64" },
      { id: "aaaa1111", name: "SM64 Hacks" },
    ]);
  });

  test("ranks an exact name, then names starting with the text, then words starting with it", async () => {
    const found = [
      game("aaaa1111", "Dr. Mariomix"),
      game("bbbb2222", "Super Mario 64"),
      game("cccc3333", "Mario Kart 8"),
      game("dddd4444", "MARIO"),
    ];
    const api = fakeApi({
      "/api/v1/games?abbreviation=mario&_bulk=yes": { data: [] },
      "/api/v1/games?name=mario&max=50&_bulk=yes": { data: found },
    });

    const games = await catalog(api).searchGames("mario");

    expect(games === "unavailable" ? games : games.map((g) => g.name)).toEqual([
      "MARIO",
      "Mario Kart 8",
      "Super Mario 64",
      "Dr. Mariomix",
    ]);
  });

  // speedrun.com matches each letter run anywhere, so "sm" would find "Chasm".
  test("drops names that contain the text only in the middle of a word", async () => {
    const api = fakeApi({
      "/api/v1/games?abbreviation=smash&_bulk=yes": { data: [] },
      "/api/v1/games?name=smash&max=50&_bulk=yes": {
        data: [game("aaaa1111", "Astrosmash"), game("bbbb2222", "Smash TV")],
      },
    });

    const games = await catalog(api).searchGames("smash");

    expect(games === "unavailable" ? games : games.map((g) => g.name)).toEqual(["Smash TV"]);
  });

  test("reads punctuation in the text like the punctuation in names", async () => {
    const found = [game("aaaa1111", "The Legend of Zelda: Ocarina of Time")];
    const api = fakeApi({
      "/api/v1/games?name=zelda%3A+ocarina&max=50&_bulk=yes": { data: found },
    });

    const games = await catalog(api).searchGames("zelda: ocarina");

    expect(games === "unavailable" ? games : games.map((g) => g.name)).toEqual([
      "The Legend of Zelda: Ocarina of Time",
    ]);
  });

  test("needs every typed word in the name", async () => {
    const found = [game("aaaa1111", "Super Mario Bros"), game("bbbb2222", "Super Mario 64")];
    const api = fakeApi({ "/api/v1/games?name=mario+64&max=50&_bulk=yes": { data: found } });

    const games = await catalog(api).searchGames("mario 64");

    expect(games === "unavailable" ? games : games.map((g) => g.name)).toEqual(["Super Mario 64"]);
  });

  test("only tries the abbreviation for 2 letters", async () => {
    const api = fakeApi({ "/api/v1/games?abbreviation=oot&_bulk=yes": { data: [] } });
    const games = catalog(api);

    await games.searchGames("oo");

    const v1 = api.requests
      .map((r) => new URL(r.url))
      .filter((url) => url.pathname.includes("/v1/"));
    expect(v1.map((url) => url.search)).toEqual(["?abbreviation=oo&_bulk=yes"]);
  });
});

describe("SpeedrunCatalog.categories", () => {
  test("lists the full-game categories only", async () => {
    const data = [
      { id: "wkpqmw8d", name: "Stage RTA", type: "per-level" },
      { id: "n2y55mko", name: "16 Star", type: "per-game" },
      { id: "7dgrrxk4", name: "120 Star", type: "per-game" },
    ];
    const api = fakeApi({ [categoriesPath]: { data } });

    expect(await catalog(api).categories("o1y9wo6q")).toEqual([
      { id: "n2y55mko", name: "16 Star" },
      { id: "7dgrrxk4", name: "120 Star" },
    ]);
  });

  test("refuses an id that isn't a speedrun.com game id", async () => {
    const api = fakeApi({});

    expect(await catalog(api).categories("../users")).toBe("unavailable");
    expect(api.requests).toHaveLength(0);
  });
});
