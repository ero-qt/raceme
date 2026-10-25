import { type RoomRefusal, maxChatLength } from "../../shared/protocol.ts";
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
  lock: "Lock",
  unlock: "Unlock",
  mute: "Mute",
  unmute: "Unmute",
  end: ".end",
  rematch: ".rematch",
};

export const refusalText: Record<RoomRefusal, string> = {
  alreadyFinished: "You already have a result.",
  alreadyJoined: "You're already in this race.",
  badChat: `Messages need 1 to ${maxChatLength} characters.`,
  badGoal: "The goal needs 1 to 200 characters.",
  badMessage: "The server didn't understand that.",
  badName: "Your name needs 1 to 24 characters.",
  nameTaken: "Someone in this race already has that name.",
  noGoal: "The host has to set a goal before anyone can ready up.",
  notDone: "You haven't finished.",
  notEntrant: "Join the race first.",
  notForfeit: "You haven't forfeited.",
  notHost: "Only the host can do that.",
  raceFull: "This race is full.",
  entryClosed: "Entry is closed.",
  badCap: "The entrant limit needs a number from 2 to 50.",
  rateLimited: "Slow down a little.",
  muted: "You have been muted.",
  slowMode: "Slow mode is on, wait a moment before your next message.",
  roomGone: "This room has closed.",
  tooEarly: "Too early. Wait 5 seconds after GO.",
  wrongPhase: "You can't do that right now.",
};
