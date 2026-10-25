import type { Entrant, RaceState } from "./types.ts";

export interface Standing extends Entrant {
  /** Gives the 1-based finishing place. It stays `null` while racing and after a forfeit. */
  readonly place: number | null;
}

/** Orders entrants the way SRL lists them: finishers by time, then racers, then forfeits. */
export function standings(state: RaceState): Standing[] {
  const finishers = state.entrants
    .flatMap((e) => (e.result?.kind === "done" ? [{ entrant: e, timeMs: e.result.timeMs }] : []))
    .sort((a, b) => a.timeMs - b.timeMs)
    .map(({ entrant }, index) => ({ ...entrant, place: index + 1 }));
  const racing = state.entrants.filter((e) => e.result === null).map(unplaced);
  const forfeits = state.entrants.filter((e) => e.result?.kind === "forfeit").map(unplaced);

  return [...finishers, ...racing, ...forfeits];
}

function unplaced(entrant: Entrant): Standing {
  return { ...entrant, place: null };
}
