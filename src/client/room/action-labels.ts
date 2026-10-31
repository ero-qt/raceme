import { type RoomRefusal, maxChatLength } from "../../shared/protocol.ts";
import { maxGoalLength, maxNameLength } from "../../shared/race/race.ts";
import type { ActionType } from "./available-actions.ts";

// SRL's RaceBot commands. `.undone` also took back a `.quit`, so both undo actions share it.
export const actionLabel: Record<ActionType, string> = {
  join: ".enter",
  leave: ".unenter",
  ready: ".ready",
  unready: ".unready",
  done: ".done",
  undone: ".undone",
  forfeit: ".quit",
  unforfeit: ".undone",
  setGoal: ".setgoal",
  remove: ".remove",
  lock: "lock",
  unlock: "unlock",
  mute: "mute",
  unmute: "unmute",
  end: ".end",
  rematch: ".rematch",
};

export const refusalText: Record<RoomRefusal, string> = {
  alreadyFinished: "you already have a result.",
  alreadyJoined: "you're already in this race.",
  badChat: `a message needs to be 1-${maxChatLength} characters long.`,
  badGoal: `the goal needs to be 1-${maxGoalLength} characters long.`,
  badMessage: "the server didn't understand that.",
  badName: `a name needs to be 1-${maxNameLength} characters long.`,
  nameTaken: "someone in this race already has that name.",
  noGoal: "the host has to set a goal before anyone can ready up.",
  notDone: "you haven't finished.",
  notEntrant: "join the race first.",
  notForfeit: "you haven't forfeited.",
  notHost: "only the host can do that.",
  raceFull: "this race is full.",
  entryClosed: "entry is closed.",
  badCap: "the entrant limit needs a number from 2 to 300.",
  rateLimited: "slow down a little.",
  muted: "you are muted.",
  slowMode: "slow mode is on, wait a moment before your next message.",
  roomGone: "this room has closed.",
  tooEarly: "too early. wait 5 seconds after GO.",
  wrongPhase: "you can't do that right now.",
};
