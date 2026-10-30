import type { JSX } from "solid-js";
import type { RaceState } from "../../shared/race/race.ts";
import { type Status, StatusBadge } from "../primitives/status-badge.tsx";

const roomStatus: Record<RaceState["phase"], Status> = {
  open: "open",
  countdown: "countdown",
  running: "running",
  finished: "done",
  terminated: "forfeit",
};

const roomStatusLabel: Partial<Record<RaceState["phase"], string>> = {
  finished: "complete",
  terminated: "terminated",
};

/** Shows the room's phase as a badge. Before the start, closed entry shows instead of the phase. */
export function RoomStatus(props: { race: RaceState }): JSX.Element {
  const beforeStart = () => props.race.phase === "open" || props.race.phase === "countdown";
  const label = () =>
    props.race.entryLocked && beforeStart() ? "entry closed" : roomStatusLabel[props.race.phase];
  const status = () =>
    props.race.entryLocked && beforeStart() ? "forfeit" : roomStatus[props.race.phase];
  return <StatusBadge status={status()} {...(label() ? { label: label() } : {})} />;
}
