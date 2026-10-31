import type { FeedEntry } from "./feed-entry.ts";
import type { FractionDigits } from "./format-time.ts";
import type { RaceRefusal, RaceState } from "./race/race.ts";

export type ClientAction =
  | { type: "join"; name: string }
  | { type: "setGoal"; goal: string }
  | { type: "say"; text: string }
  | { type: "remove"; entrantId: string }
  | { type: "mute"; entrantId: string }
  | { type: "unmute"; entrantId: string }
  | { type: "setFractionDigits"; digits: FractionDigits }
  | { type: "setEntrantCap"; cap: number | null }
  | { type: "end" }
  | { type: "rematch" }
  | { type: "lock" }
  | { type: "unlock" }
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

export const maxChatLength = 512;

export type RoomRefusal =
  | RaceRefusal
  | "notHost"
  | "roomGone"
  | "badMessage"
  | "badChat"
  | "slowMode"
  | "muted"
  | "rateLimited";

/** Tells whether the room's lifetime or a queued server restart closes the room. */
export type ClosesFor = "lifetime" | "restart";

/** Identifies the viewer in a room: the entrant id their session owns and whether they host. */
export interface Me {
  entrantId: string;
  isHost: boolean;
}

export type ServerMessage =
  | ({ type: "welcome"; chatEveryMs: number } & Me)
  /**
   * Gives the room's state, with `closesAt` as the server time the room will close and `watchers`
   * as the number of people with the room open who haven't entered.
   */
  | {
      type: "state";
      race: RaceState;
      serverNow: number;
      closesAt: number;
      closesFor: ClosesFor;
      watchers: number;
    }
  /** Gives a new watcher count alone, since a full state would reset every client's clock. */
  | { type: "watchers"; count: number }
  | { type: "feed"; entries: FeedEntry[] }
  | { type: "refused"; refusal: RoomRefusal }
  | { type: "idleWarning"; closesAt: number; quietFor: string }
  | { type: "restartWarning"; closesAt: number }
  | { type: "idleCleared" };

/**
 * Caps one client message, in UTF-16 units and in bytes alike. JSON can grow each character of a
 * chat line to the 6 characters of `\uXXXX`. No character takes more than 6 bytes either way, so a
 * full line plus the rest of the message always fits.
 */
export const maxMessageLength = maxChatLength * 6 + 256;
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
  "lock",
  "unlock",
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

  const { type, name, goal, text, entrantId, digits, cap } = message as Record<string, unknown>;
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
  if (type === "setEntrantCap") {
    return cap === null || typeof cap === "number" ? { type, cap } : null;
  }
  if (type === "remove" || type === "mute" || type === "unmute") {
    return typeof entrantId === "string" ? { type, entrantId } : null;
  }

  return typeof type === "string" && plainActions.has(type) ? ({ type } as ClientAction) : null;
}
