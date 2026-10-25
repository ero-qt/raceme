import { cleanText } from "../clean-text.ts";
import type {
  Entrant,
  EntrantResult,
  RaceAction,
  RaceRefusal,
  RaceResult,
  RaceSettings,
  RaceState,
} from "./types.ts";

export type { Standing } from "./standings.ts";
export { standings } from "./standings.ts";
export type * from "./types.ts";

const maxNameLength = 24;
const maxGoalLength = 200;
const maxEntrants = 50;
// Entrants named like the bot could post chat that passes for its announcements.
const reservedNames = new Set(["racebot"]);
// Same guard racetime.gg uses against a finish or forfeit clicked by accident right after GO.
const earliestResultMs = 5_000;

/** Lists the settings a new race needs, with the rest falling back to defaults. */
export type NewRaceSettings = Pick<RaceSettings, "countdownMs"> & Partial<RaceSettings>;

export function createRace(settings: NewRaceSettings): RaceState {
  return {
    phase: "open",
    goal: null,
    entrants: [],
    settings: { fractionDigits: 0, ...settings },
    startsAt: null,
    endedAt: null,
    muted: [],
  };
}

/** Applies one action at server time `now`. A refused action leaves the state alone. */
export function apply(state: RaceState, action: RaceAction, now: number): RaceResult {
  switch (action.type) {
    case "tick":
      return ok(
        state.phase === "countdown" && state.startsAt !== null && now >= state.startsAt
          ? { ...state, phase: "running" }
          : state,
      );
    case "setGoal":
      return setGoal(state, action.goal);
    case "join":
      return join(state, action.entrantId, action.name);
    case "remove":
      return remove(state, action.targetId, now);
    case "mute":
      return state.entrants.some((e) => e.id === action.targetId)
        ? ok({ ...state, muted: [...new Set([...state.muted, action.targetId])] })
        : refuse("notEntrant");
    case "unmute":
      return ok({ ...state, muted: state.muted.filter((id) => id !== action.targetId) });
    case "end":
      return isOver(state)
        ? refuse("wrongPhase")
        : ok({ ...stopCountdown(state), phase: "terminated", endedAt: now });
    case "setFractionDigits":
      return ok({ ...state, settings: { ...state.settings, fractionDigits: action.digits } });
    case "rematch":
      return isOver(state)
        ? ok({ ...createRace(state.settings), goal: state.goal, muted: state.muted })
        : refuse("wrongPhase");
    default:
      return applyEntrantAction(state, action, now);
  }
}

function setGoal(state: RaceState, rawGoal: string): RaceResult {
  if (!beforeStart(state)) {
    return refuse("wrongPhase");
  }

  const goal = cleanText(rawGoal);
  if (goal.length === 0 || goal.length > maxGoalLength) {
    return refuse("badGoal");
  }

  return ok(stopCountdown({ ...state, goal, entrants: state.entrants.map(unreadied) }));
}

function join(state: RaceState, entrantId: string, rawName: string): RaceResult {
  if (!beforeStart(state)) {
    return refuse("wrongPhase");
  }

  const name = cleanText(rawName);
  if (name.length === 0 || name.length > maxNameLength) {
    return refuse("badName");
  }
  if (state.entrants.some((e) => e.id === entrantId)) {
    return refuse("alreadyJoined");
  }
  if (state.entrants.length >= maxEntrants) {
    return refuse("raceFull");
  }
  if (
    reservedNames.has(nameKey(name)) ||
    state.entrants.some((e) => nameKey(e.name) === nameKey(name))
  ) {
    return refuse("nameTaken");
  }

  const entrant: Entrant = { id: entrantId, name, ready: false, result: null };
  return ok(stopCountdown({ ...state, entrants: [...state.entrants, entrant] }));
}

function remove(state: RaceState, targetId: string, now: number): RaceResult {
  if (!beforeStart(state)) {
    return refuse("wrongPhase");
  }
  if (!state.entrants.some((e) => e.id === targetId)) {
    return refuse("notEntrant");
  }

  const entrants = state.entrants.filter((e) => e.id !== targetId);
  return ok(startOrStopCountdown({ ...state, entrants }, now));
}

type EntrantAction = Exclude<
  RaceAction,
  {
    type:
      | "tick"
      | "setGoal"
      | "join"
      | "remove"
      | "mute"
      | "unmute"
      | "end"
      | "rematch"
      | "setFractionDigits";
  }
>;

function applyEntrantAction(state: RaceState, action: EntrantAction, now: number): RaceResult {
  const entrant = state.entrants.find((e) => e.id === action.entrantId);
  if (!entrant) {
    return refuse("notEntrant");
  }

  switch (action.type) {
    case "leave":
      return leave(state, entrant, now);
    case "ready":
      return ready(state, entrant, now);
    case "unready":
      return unready(state, entrant);
    case "done":
    case "forfeit":
      return finish(state, entrant, action.type, now);
    case "undone":
    case "unforfeit":
      return takeBack(state, entrant, action.type === "undone" ? "done" : "forfeit");
  }
}

function leave(state: RaceState, entrant: Entrant, now: number): RaceResult {
  if (!beforeStart(state)) {
    return refuse("wrongPhase");
  }

  const entrants = state.entrants.filter((e) => e !== entrant);
  return ok(startOrStopCountdown({ ...state, entrants }, now));
}

function ready(state: RaceState, entrant: Entrant, now: number): RaceResult {
  if (state.phase !== "open") {
    return refuse("wrongPhase");
  }
  if (state.goal === null) {
    return refuse("noGoal");
  }

  return ok(startOrStopCountdown(replaced(state, { ...entrant, ready: true }), now));
}

function unready(state: RaceState, entrant: Entrant): RaceResult {
  if (!beforeStart(state)) {
    return refuse("wrongPhase");
  }

  return ok(stopCountdown(replaced(state, unreadied(entrant))));
}

function finish(
  state: RaceState,
  entrant: Entrant,
  kind: "done" | "forfeit",
  now: number,
): RaceResult {
  const elapsed = elapsedForResult(state, entrant, now);
  if (typeof elapsed === "string") {
    return refuse(elapsed);
  }

  const result: EntrantResult =
    kind === "done" ? { kind: "done", timeMs: elapsed } : { kind: "forfeit" };
  return ok(endIfAllFinished(replaced(state, { ...entrant, result }), now));
}

/** Takes back a finish or a forfeit, which also reopens a race that had finished. */
function takeBack(state: RaceState, entrant: Entrant, kind: "done" | "forfeit"): RaceResult {
  if (state.phase !== "running" && state.phase !== "finished") {
    return refuse("wrongPhase");
  }
  if (entrant.result?.kind !== kind) {
    return refuse(kind === "done" ? "notDone" : "notForfeit");
  }

  const racing = replaced(state, { ...entrant, result: null });
  return ok({ ...racing, phase: "running", endedAt: null });
}

/** Returns the ms since GO when `entrant` may finish or forfeit now, else the refusal. */
function elapsedForResult(state: RaceState, entrant: Entrant, now: number): number | RaceRefusal {
  if (state.phase !== "running" || state.startsAt === null) {
    return "wrongPhase";
  }
  if (entrant.result !== null) {
    return "alreadyFinished";
  }

  const elapsed = now - state.startsAt;
  return elapsed < earliestResultMs ? "tooEarly" : elapsed;
}

function startOrStopCountdown(state: RaceState, now: number): RaceState {
  const allReady = state.entrants.length > 0 && state.entrants.every((e) => e.ready);

  if (!allReady) {
    return stopCountdown(state);
  }
  if (state.phase === "countdown") {
    return state;
  }
  return { ...state, phase: "countdown", startsAt: now + state.settings.countdownMs };
}

function stopCountdown(state: RaceState): RaceState {
  return state.phase === "countdown" ? { ...state, phase: "open", startsAt: null } : state;
}

function endIfAllFinished(state: RaceState, now: number): RaceState {
  return state.entrants.every((e) => e.result !== null)
    ? { ...state, phase: "finished", endedAt: now }
    : state;
}

function beforeStart(state: RaceState): boolean {
  return state.phase === "open" || state.phase === "countdown";
}

function isOver(state: RaceState): boolean {
  return state.phase === "finished" || state.phase === "terminated";
}

function replaced(state: RaceState, changed: Entrant): RaceState {
  return { ...state, entrants: state.entrants.map((e) => (e.id === changed.id ? changed : e)) };
}

function unreadied(entrant: Entrant): Entrant {
  return entrant.ready ? { ...entrant, ready: false } : entrant;
}

/** Compares names case-blind and with look-alike forms folded, like full-width `ｂｏｂ` and `bob`. */
function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

function ok(state: RaceState): RaceResult {
  return { ok: true, state };
}

function refuse(refusal: RaceRefusal): RaceResult {
  return { ok: false, refusal };
}
