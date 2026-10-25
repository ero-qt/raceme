import { cleanText } from "../shared/clean-text.ts";
import { catalogCacheHours } from "../shared/retention.ts";
import { TokenBucket } from "./rate-limit.ts";

export interface CatalogEntry {
  id: string;
  name: string;
}

export type CatalogResult = CatalogEntry[] | "unavailable";

const searchTtlMs = 60 * 60_000;
const siteSearchRetryMs = 10 * 60_000;
const categoriesTtlMs = catalogCacheHours * 60 * 60_000;
const maxCacheEntries = 2000;
const maxResults = 10;
// speedrun.com sorts name matches by length, so raceme asks for more and ranks them itself.
const nameCandidates = 50;
const minQueryLength = 2;
const minNameQueryLength = 3;
const maxQueryLength = 60;
const maxNameLength = 100;
const requestTimeoutMs = 5_000;
// speedrun.com ids are short lowercase base36 strings, so anything else never reaches its URL.
const idShape = /^[a-z0-9]{6,12}$/;

/** Checks that an id has the shape of a speedrun.com id, so nothing else reaches its URLs. */
export function isGameId(id: string): boolean {
  return idShape.test(id);
}
const userAgent = "raceme (+https://ero-qt.eu/apps/raceme)";

interface CatalogOptions {
  apiUrl: string;
  clock: () => number;
  fetch?: typeof fetch;
  /** Requests to speedrun.com allowed per minute across all visitors. */
  perMinute?: number;
}

/** Gives `"overBudget"` when raceme's own request budget ran out, while speedrun.com may be fine. */
type LookupResult = CatalogResult | "overBudget";

interface Cached {
  value: CatalogEntry[];
  expiresAt: number;
}

/**
 * Looks up games and their categories on speedrun.com for the start page. Only the server talks
 * to speedrun.com, so visitors' browsers never contact it.
 */
export class SpeedrunCatalog {
  readonly #cache = new Map<string, Cached>();
  readonly #budget: TokenBucket;
  readonly #fetch: typeof fetch;
  readonly #options: CatalogOptions;
  // Keys are request paths and values the answers still on their way, so identical searches
  // arriving together share one request.
  readonly #pending = new Map<string, Promise<LookupResult>>();
  #siteSearchDownUntil = 0;

  constructor(options: CatalogOptions) {
    this.#options = options;
    const perMinute = options.perMinute ?? 60;
    this.#budget = new TokenBucket(perMinute, perMinute / 60, options.clock());
    this.#fetch = options.fetch ?? fetch;
  }

  /**
   * Finds games for the start page's picker, best matches first. It asks the search that
   * speedrun.com's own site uses because that search ranks popular games first. When that fails,
   * it asks the documented v1 API instead.
   */
  async searchGames(query: string): Promise<CatalogResult> {
    const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
    if (normalized.length < minQueryLength || normalized.length > maxQueryLength) {
      return [];
    }

    const fromSite = await this.#searchSite(normalized);
    if (fromSite === "overBudget") {
      return "unavailable";
    }

    return fromSite === "unavailable" ? this.#searchV1(normalized) : fromSite;
  }

  // The v2 API has no published docs and may change, so an unknown answer shape counts as failed.
  async #searchSite(query: string): Promise<LookupResult> {
    const now = this.#options.clock();
    if (now < this.#siteSearchDownUntil) {
      return "unavailable";
    }

    const params = { query, includeGames: true, limit: maxResults };
    const encoded = Buffer.from(JSON.stringify(params)).toString("base64url");
    const result = await this.#lookUp(`v2/GetSearch?_r=${encoded}`, searchTtlMs, (body) => {
      const games = record(body)?.gameList;
      return Array.isArray(games) ? entries(games, (game) => game.name) : null;
    });
    // A failed site search rests for a while, so searches don't pay for 2 requests each meanwhile.
    if (result === "unavailable") {
      this.#siteSearchDownUntil = now + siteSearchRetryMs;
    }
    return result;
  }

  // speedrun.com's v1 name search has no ranking, so its results are filtered and sorted here.
  async #searchV1(normalized: string): Promise<CatalogResult> {
    const [byAbbreviation, byName] = await Promise.all([
      this.#findByAbbreviation(normalized),
      normalized.length >= minNameQueryLength ? this.#findByName(normalized) : null,
    ]);
    const tried = [byAbbreviation, byName].filter((result) => result !== null);
    if (tried.every((result) => result === "unavailable" || result === "overBudget")) {
      return "unavailable";
    }

    const abbreviated = Array.isArray(byAbbreviation) ? byAbbreviation : [];
    const named = Array.isArray(byName) ? rankByName(byName, normalized) : [];
    const seen = new Set(abbreviated.map((game) => game.id));
    return [...abbreviated, ...named.filter((game) => !seen.has(game.id))].slice(0, maxResults);
  }

  // Abbreviations like `sm64` never contain spaces, so a query with spaces gives `null` unasked.
  async #findByAbbreviation(query: string): Promise<LookupResult | null> {
    if (query.includes(" ")) {
      return null;
    }

    const params = new URLSearchParams({ abbreviation: query, _bulk: "yes" });
    return this.#lookUp(`v1/games?${params}`, searchTtlMs, v1List(gameEntries));
  }

  async #findByName(query: string): Promise<LookupResult> {
    const params = new URLSearchParams({ name: query, max: String(nameCandidates), _bulk: "yes" });
    return this.#lookUp(`v1/games?${params}`, searchTtlMs, v1List(gameEntries));
  }

  /** Lists a game's full-game categories. Per-level categories are left out for now. */
  async categories(gameId: string): Promise<CatalogResult> {
    if (!isGameId(gameId)) {
      return "unavailable";
    }

    const result = await this.#lookUp(
      `v1/games/${gameId}/categories`,
      categoriesTtlMs,
      v1List((data) =>
        entries(
          data.filter((category) => record(category)?.type === "per-game"),
          (category) => category.name,
        ),
      ),
    );
    return result === "overBudget" ? "unavailable" : result;
  }

  async #lookUp(
    path: string,
    ttlMs: number,
    /** Reads the answer, giving `null` for one it can't read. */
    parse: (body: unknown) => CatalogEntry[] | null,
  ): Promise<LookupResult> {
    const now = this.#options.clock();
    const cached = this.#cache.get(path);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const pending = this.#pending.get(path);
    if (pending) {
      return pending;
    }

    const lookup = this.#fetchAndRemember(path, now, ttlMs, parse);
    this.#pending.set(path, lookup);
    try {
      return await lookup;
    } finally {
      this.#pending.delete(path);
    }
  }

  async #fetchAndRemember(
    path: string,
    now: number,
    ttlMs: number,
    parse: (body: unknown) => CatalogEntry[] | null,
  ): Promise<LookupResult> {
    if (!this.#budget.take(now)) {
      return "overBudget";
    }

    const body = await this.#request(path);
    const value = body === null ? null : parse(body);
    if (value === null) {
      return "unavailable";
    }

    this.#remember(path, { value, expiresAt: now + ttlMs });
    return value;
  }

  async #request(path: string): Promise<unknown> {
    try {
      const response = await this.#fetch(`${this.#options.apiUrl}/${path}`, {
        headers: { accept: "application/json", "user-agent": userAgent },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  // Map keeps insertion order, so the first key is the oldest entry.
  #remember(path: string, entry: Cached): void {
    this.#cache.delete(path);
    this.#cache.set(path, entry);
    if (this.#cache.size > maxCacheEntries) {
      const oldest = this.#cache.keys().next().value;
      if (oldest !== undefined) {
        this.#cache.delete(oldest);
      }
    }
  }
}

/** Reads the `data` list every v1 answer wraps its results in. */
function v1List(
  parse: (data: unknown[]) => CatalogEntry[],
): (body: unknown) => CatalogEntry[] | null {
  return (body) => {
    const data = record(body)?.data;
    return Array.isArray(data) ? parse(data) : null;
  };
}

function gameEntries(data: unknown[]): CatalogEntry[] {
  return entries(data, (game) => record(game.names)?.international);
}

/**
 * Keeps the games where every typed word starts a word of the title and sorts them with the
 * exact title first, then titles that start with the text, then the text as whole words, then the
 * rest. Ties keep speedrun.com's order.
 */
function rankByName(games: CatalogEntry[], query: string): CatalogEntry[] {
  const typed = wordsOf(query);
  const scored = games.flatMap((game) => {
    const name = game.name.toLowerCase();
    const words = wordsOf(name);
    if (!typed.every((part) => words.some((word) => word.startsWith(part)))) {
      return [];
    }

    const wholeWords = ` ${words.join(" ")} `.includes(` ${typed.join(" ")} `);
    const score = name === query ? 0 : name.startsWith(query) ? 1 : wholeWords ? 2 : 3;
    return [{ game, score }];
  });

  return scored.sort((a, b) => a.score - b.score).map(({ game }) => game);
}

function wordsOf(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Keeps the items with a valid id and a usable name, since the answer comes from outside. */
function entries(
  data: unknown[],
  nameOf: (item: Record<string, unknown>) => unknown,
): CatalogEntry[] {
  return data.flatMap((item) => {
    const fields = record(item);
    const name = fields && nameOf(fields);
    if (!fields || typeof fields.id !== "string" || !idShape.test(fields.id)) {
      return [];
    }
    if (typeof name !== "string") {
      return [];
    }

    const clean = cleanText(name).slice(0, maxNameLength);
    return clean === "" ? [] : [{ id: fields.id, name: clean }];
  });
}
