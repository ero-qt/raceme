import type { ClientAction } from "../../shared/protocol.ts";
import { type RaceState, beforeStart, isOver, maxEntrants } from "../../shared/race/race.ts";

export type ActionType = Exclude<
  ClientAction["type"],
  "say" | "setFractionDigits" | "setEntrantCap" | "active"
>;

/** Lists the actions the viewer can take right now, in the order their buttons show. */
export function availableActions(
  race: RaceState,
  entrantId: string,
  isHost: boolean,
): ActionType[] {
  const entrant = race.entrants.find((e) => e.id === entrantId);
  const rematch: ActionType[] = isOver(race) && (entrant || isHost) ? ["rematch"] : [];

  if (race.phase === "terminated") {
    return rematch;
  }
  if (!entrant) {
    const full = race.entrants.length >= (race.settings.entrantCap ?? maxEntrants);
    return beforeStart(race) && !race.entryLocked && !full
      ? ["join"]
      : beforeStart(race)
        ? []
        : rematch;
  }
  if (beforeStart(race)) {
    return [entrant.ready ? "unready" : "ready", "leave"];
  }
  switch (entrant.result?.kind) {
    case "done":
      return ["undone", ...rematch];
    case "forfeit":
      return ["unforfeit", ...rematch];
    default:
      return ["done", "forfeit"];
  }
}
