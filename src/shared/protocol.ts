import type { FeedEntry } from "./feed-entry.ts";
import type { FractionDigits } from "./format-time.ts";
import type { RaceRefusal, RaceState } from "./race/race.ts";

export type ClientAction =
  | { type: "join"; name: string }
  | { type: "setGoal"; goal: string }
  | { type: "say"; text: string }
  | { type: "remove"; entrantId: string }
  | { type: "setFractionDigits"; digits: FractionDigits }
  | { type: "end" }
  | { type: "rematch" }
  /** Tells the server someone is still at the screen, so the room doesn't end as idle. */
  | { type: "active" }
  | { type: EntrantActionType };

type EntrantActionType =
  | "leave"
  | "ready"
  | "unready"
  | "done"
  | "undone"
  | "forfeit"
  | "unforfeit";

export type RoomRefusal =
  | RaceRefusal
  | "notHost"
  | "roomGone"
  | "badMessage"
  | "badChat"
  | "rateLimited";

export type ServerMessage =
  | { type: "welcome"; entrantId: string; isHost: boolean }
  | { type: "state"; race: RaceState; serverNow: number }
  | { type: "feed"; entries: FeedEntry[] }
  | { type: "refused"; refusal: RoomRefusal }
  | { type: "idleWarning"; closesAt: number }
  | { type: "idleCleared" };

const maxMessageLength = 1024;
const plainActions = new Set([
  "leave",
  "ready",
  "unready",
  "done",
  "undone",
  "forfeit",
  "unforfeit",
  "active",
  "end",
  "rematch",
]);

/** Reads one client message, keeping only the fields its action type allows. */
export function parseClientAction(raw: string): ClientAction | null {
  if (raw.length > maxMessageLength) {
    return null;
  }

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return null;
  }

  const { type, name, goal, text, entrantId, digits } = message as Record<string, unknown>;
  if (type === "join") {
    return typeof name === "string" ? { type, name } : null;
  }
  if (type === "setGoal") {
    return typeof goal === "string" ? { type, goal } : null;
  }
  if (type === "say") {
    return typeof text === "string" ? { type, text } : null;
  }
  if (type === "setFractionDigits") {
    return digits === 0 || digits === 1 || digits === 2 || digits === 3 ? { type, digits } : null;
  }
  if (type === "remove") {
    return typeof entrantId === "string" ? { type, entrantId } : null;
  }

  return typeof type === "string" && plainActions.has(type) ? ({ type } as ClientAction) : null;
}
