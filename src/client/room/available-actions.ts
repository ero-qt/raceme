import type { ClientAction } from "../../shared/protocol.ts";
import type { RaceState } from "../../shared/race/race.ts";

export type ActionType = Exclude<ClientAction["type"], "say" | "setFractionDigits" | "active">;

/** Lists the actions the viewer can take right now, in the order their buttons show. */
export function availableActions(
  race: RaceState,
  entrantId: string,
  isHost: boolean,
): ActionType[] {
  const entrant = race.entrants.find((e) => e.id === entrantId);
  const beforeStart = race.phase === "open" || race.phase === "countdown";
  const isOver = race.phase === "finished" || race.phase === "terminated";
  const rematch: ActionType[] = isOver && (entrant || isHost) ? ["rematch"] : [];

  if (race.phase === "terminated") {
    return rematch;
  }
  if (!entrant) {
    return beforeStart ? ["join"] : rematch;
  }
  if (beforeStart) {
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
