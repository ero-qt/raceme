import type { FractionDigits } from "../format-time.ts";

export type RacePhase = "open" | "countdown" | "running" | "finished" | "terminated";

export type EntrantResult = { kind: "done"; timeMs: number } | { kind: "forfeit" };

export interface Entrant {
  readonly id: string;
  readonly name: string;
  readonly ready: boolean;
  readonly result: EntrantResult | null;
}

export interface RaceSettings {
  readonly countdownMs: number;
  /** Sets the room's default time precision, which viewers may override for themselves. */
  readonly fractionDigits: FractionDigits;
}

export interface RaceState {
  readonly phase: RacePhase;
  readonly goal: string | null;
  readonly entrants: readonly Entrant[];
  readonly settings: RaceSettings;
  /** Server time in ms when the countdown reaches GO, set from the countdown on. */
  readonly startsAt: number | null;
  /** Server time in ms of the last finish or forfeit that ended the race. */
  readonly endedAt: number | null;
}

export type RaceAction =
  | { type: "setGoal"; goal: string }
  | { type: "join"; entrantId: string; name: string }
  | { type: "leave"; entrantId: string }
  | { type: "ready"; entrantId: string }
  | { type: "unready"; entrantId: string }
  | { type: "done"; entrantId: string }
  | { type: "undone"; entrantId: string }
  | { type: "forfeit"; entrantId: string }
  | { type: "unforfeit"; entrantId: string }
  | { type: "remove"; targetId: string }
  | { type: "end" }
  | { type: "rematch" }
  | { type: "setFractionDigits"; digits: FractionDigits }
  | { type: "tick" };

export type RaceRefusal =
  | "alreadyFinished"
  | "alreadyJoined"
  | "badGoal"
  | "badName"
  | "nameTaken"
  | "noGoal"
  | "notDone"
  | "notEntrant"
  | "notForfeit"
  | "raceFull"
  | "tooEarly"
  | "wrongPhase";

export type RaceResult = { ok: true; state: RaceState } | { ok: false; refusal: RaceRefusal };
