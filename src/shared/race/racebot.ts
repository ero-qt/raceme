import { formatClock } from "../format-time.ts";
import type { EntrantResult, RaceAction, RaceState } from "./types.ts";

// Countdown calls RaceBot made before GO!, in seconds.
const countdownSeconds = [5, 4, 3, 2, 1];

/** Returns the lines SRL's RaceBot posted for an action that turned `before` into `after`. */
export function announce(before: RaceState, action: RaceAction, after: RaceState): string[] {
  if (action.type === "tick") {
    return before.phase === "countdown" && after.phase === "running" ? ["GO!"] : [];
  }
  if (action.type === "setGoal") {
    return before.goal === after.goal ? [] : [`Goal Set: ${after.goal}`];
  }
  if (action.type === "end") {
    return ["Race terminated. The channel will be cleared in 10 minutes!"];
  }
  if (action.type === "rematch") {
    return ["Rematch!"];
  }
  if (
    action.type === "setFractionDigits" ||
    action.type === "lock" ||
    action.type === "unlock" ||
    action.type === "setEntrantCap" ||
    action.type === "mute" ||
    action.type === "unmute"
  ) {
    return [];
  }
  if (action.type === "remove") {
    const removed = before.entrants.find((e) => e.id === action.targetId);
    return [
      `${removed?.name ?? ""} has been removed from the race.`,
      ...countdownStart(before, after),
    ];
  }

  const entrant =
    after.entrants.find((e) => e.id === action.entrantId) ??
    before.entrants.find((e) => e.id === action.entrantId);
  const name = entrant?.name ?? "";

  switch (action.type) {
    case "join": {
      const count = after.entrants.length;
      return [`${name} enters the race! ${count} ${count === 1 ? "entrant" : "entrants"}.`];
    }
    case "leave":
      return [`${name} has been removed from the race.`, ...countdownStart(before, after)];
    case "ready": {
      const remaining = after.entrants.filter((e) => !e.ready).length;
      return [`${name} is ready! ${remaining} remaining.`, ...countdownStart(before, after)];
    }
    case "unready":
      return [`${name} isn't ready!`];
    case "done":
      return [finishLine(name, entrant?.result ?? null, after)];
    case "forfeit":
      return [`${name} has forfeited from the race.`];
    case "undone":
    case "unforfeit":
      return [`${name} has been undone from the race.`];
  }
}

function finishLine(name: string, result: EntrantResult | null, after: RaceState): string {
  if (result?.kind !== "done") {
    return "";
  }

  const time = formatClock(result.timeMs, after.settings.fractionDigits);
  const place = after.entrants.filter(
    (e) => e.result?.kind === "done" && e.result.timeMs <= result.timeMs,
  ).length;
  return `${name} has finished in ${ordinal(place)} place with a time of ${time}.`;
}

/** Announces the countdown when an action starts it. */
function countdownStart(before: RaceState, after: RaceState): string[] {
  const seconds = after.settings.countdownMs / 1000;
  return before.phase !== "countdown" && after.phase === "countdown"
    ? [`The race will begin in ${seconds} ${seconds === 1 ? "second" : "seconds"}!`]
    : [];
}

/** Lists the countdown numbers RaceBot called, with the server time each one is due. */
export function countdownCalls(startsAt: number): { at: number; text: string }[] {
  return countdownSeconds.map((seconds) => ({
    at: startsAt - seconds * 1000,
    text: String(seconds),
  }));
}

export function ordinal(place: number): string {
  const lastTwo = place % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${place}th`;
  }

  const suffix = { 1: "st", 2: "nd", 3: "rd" }[place % 10] ?? "th";
  return `${place}${suffix}`;
}
