import { type Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";

export interface CatalogEntry {
  id: string;
  name: string;
}

const defaultSearchDelayMs = 300;
const minQueryLength = 2;

/** Asks raceme's server for speedrun.com games, giving `null` when the lookup fails. */
export async function searchGamesOnServer(query: string): Promise<CatalogEntry[] | null> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${import.meta.env.BASE_URL}api/games?${params}`).catch(() => null);
  return response?.ok ? ((await response.json()) as { games: CatalogEntry[] }).games : null;
}

/** Asks raceme's server for a speedrun.com game's categories, giving none when the lookup fails. */
export async function loadCategoriesFromServer(gameId: string): Promise<CatalogEntry[]> {
  const url = `${import.meta.env.BASE_URL}api/games/${encodeURIComponent(gameId)}/categories`;
  const response = await fetch(url).catch(() => null);
  return response?.ok ? ((await response.json()) as { categories: CatalogEntry[] }).categories : [];
}

/**
 * Searches speedrun.com games for the text once typing pauses. `query` gives `null` for text that
 * must not be searched, like a room code.
 */
export function useGameSearch(
  query: Accessor<string | null>,
  options: { searchGames: (query: string) => Promise<CatalogEntry[] | null>; delayMs?: number },
): Accessor<CatalogEntry[]> {
  const [games, setGames] = createSignal<CatalogEntry[]>([]);
  // Keys are search texts and values the games found, so text typed again needs no request.
  const found = new Map<string, CatalogEntry[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  createEffect(
    on(query, (text) => {
      clearTimeout(timer);
      const trimmed = text?.trim() ?? "";
      if (trimmed.length < minQueryLength) {
        setGames([]);
        return;
      }

      const known = found.get(trimmed.toLowerCase());
      // Until the answer arrives, only the shown games that still match stay, so the list doesn't
      // blink and nothing picked by mistake belongs to older text.
      setGames(known ?? games().filter((game) => containsEveryWord(game.name, trimmed)));
      if (known) {
        return;
      }

      timer = setTimeout(async () => {
        // A failed lookup isn't kept, so the same text tries again later.
        const result = await options.searchGames(trimmed);
        if (result === null) {
          return;
        }

        found.set(trimmed.toLowerCase(), result);
        // A slow answer for older text must not replace the list for what the field shows now.
        if (query()?.trim() === trimmed) {
          setGames(result);
        }
      }, options.delayMs ?? defaultSearchDelayMs);
    }),
  );

  return games;
}

function containsEveryWord(name: string, text: string): boolean {
  const lowerName = name.toLowerCase();
  return text
    .toLowerCase()
    .split(/\s+/)
    .every((word) => lowerName.includes(word));
}
