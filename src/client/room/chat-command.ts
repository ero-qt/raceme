import type { ClientAction } from "../../shared/protocol.ts";
import type { RaceState } from "../../shared/race/race.ts";
import { actionLabel } from "./action-labels.ts";
import type { ActionType } from "./available-actions.ts";

// `.undone` means `undone` or `unforfeit` depending on the entrant, so it's read separately.
// `.enter` needs a name and `.remove` a target, which the form and the row buttons give.
const notCommands = new Set<ActionType>(["undone", "unforfeit", "join", "remove"]);
const commandActions = new Map<string, ActionType>(
  (Object.entries(actionLabel) as [ActionType, string][])
    .filter(([type, label]) => label.startsWith(".") && !notCommands.has(type))
    .map(([type, label]) => [label, type]),
);

/**
 * Reads an SRL command typed in the chat box, like `.ready` or `.setgoal 120 star`, as the race
 * action it stands for. Gives `null` for plain chat.
 */
export function chatCommand(text: string, race: RaceState, entrantId: string): ClientAction | null {
  const [word = "", ...rest] = text.trim().split(/\s+/);
  const command = word.toLowerCase();
  const argument = rest.join(" ");

  if (command === actionLabel.setGoal) {
    return argument ? { type: "setGoal", goal: argument } : null;
  }
  if (argument) {
    return null;
  }

  if (command === actionLabel.undone) {
    const result = race.entrants.find((e) => e.id === entrantId)?.result;
    return { type: result?.kind === "forfeit" ? "unforfeit" : "undone" };
  }

  const type = commandActions.get(command);
  return type ? ({ type } as ClientAction) : null;
}
