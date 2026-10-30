import type { JSX } from "solid-js";
import { statusColor } from "./status-badge.css.ts";

export type Status = keyof typeof statusColor;

const statusLabel: Record<Status, string> = {
  open: "entry open",
  countdown: "starting",
  running: "in progress",
  done: "done",
  forfeit: "forfeit",
};

/** Shows a room or entrant status as colored text. `label` replaces the room wording. */
export function StatusBadge(props: { status: Status; label?: string }): JSX.Element {
  return <span class={statusColor[props.status]}>{props.label ?? statusLabel[props.status]}</span>;
}
