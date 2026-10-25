import { cleanText } from "../shared/clean-text.ts";
import type { NewFeedEntry } from "../shared/feed-entry.ts";
import type { ClientAction, RoomRefusal } from "../shared/protocol.ts";
import { type RaceAction, type RaceState, apply } from "../shared/race/race.ts";
import { announce } from "../shared/race/racebot.ts";
import type { Room } from "./rooms.ts";

export interface Session {
  entrantId: string;
  isHost: boolean;
}

export type RoomActionResult =
  | { ok: true; state: RaceState; lines: string[] }
  | { ok: false; refusal: RoomRefusal };

const maxChatLength = 300;
const hostActions = new Set<ClientAction["type"]>([
  "setGoal",
  "end",
  "remove",
  "setFractionDigits",
]);

/** Runs a race action as the session's entrant, with the session's rights checked first. */
export function handleAction(
  room: Room,
  session: Session,
  action: Exclude<ClientAction, { type: "say" }>,
  now: number,
): RoomActionResult {
  if (hostActions.has(action.type) && !session.isHost) {
    return { ok: false, refusal: "notHost" };
  }
  // A watcher could wipe the results before the racers save them.
  if (action.type === "rematch" && !session.isHost && !isEntrant(room.race, session)) {
    return { ok: false, refusal: "notEntrant" };
  }

  return applyAndAnnounce(room.race, toRaceAction(action, session), now);
}

function isEntrant(race: RaceState, session: Session): boolean {
  return race.entrants.some((e) => e.id === session.entrantId);
}

function toRaceAction(
  action: Exclude<ClientAction, { type: "say" }>,
  session: Session,
): RaceAction {
  switch (action.type) {
    case "setGoal":
    case "end":
    case "rematch":
    case "setFractionDigits":
      return action;
    case "remove":
      return { type: "remove", targetId: action.entrantId };
    default:
      return { ...action, entrantId: session.entrantId };
  }
}

/** Applies an action and adds the lines RaceBot posts for it. */
export function applyAndAnnounce(
  race: RaceState,
  action: RaceAction,
  now: number,
): RoomActionResult {
  const result = apply(race, action, now);
  return result.ok ? { ...result, lines: announce(race, action, result.state) } : result;
}

/** Builds a chat line from an entrant, since only entrants have a name to show. */
export function chatLine(
  room: Room,
  session: Session,
  rawText: string,
  now: number,
): NewFeedEntry | RoomRefusal {
  const entrant = room.race.entrants.find((e) => e.id === session.entrantId);
  if (!entrant) {
    return "notEntrant";
  }

  const text = cleanText(rawText);
  if (text.length === 0 || text.length > maxChatLength) {
    return "badChat";
  }

  return { kind: "chat", name: entrant.name, text, at: now };
}

/** Returns the ms until the countdown reaches GO. Without a countdown it returns `null`. */
export function nextTickDelay(race: RaceState, now: number): number | null {
  if (race.phase !== "countdown" || race.startsAt === null) {
    return null;
  }

  return Math.max(0, race.startsAt - now);
}
