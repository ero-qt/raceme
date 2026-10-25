import { For, type JSX, Show } from "solid-js";
import { type FractionDigits, formatClock } from "../../shared/format-time.ts";
import type { Standing } from "../../shared/race/race.ts";
import { StatusBadge } from "../primitives/status-badge.tsx";
import * as styles from "./room.css.ts";

export function EntrantTable(props: {
  rows: Standing[];
  started: boolean;
  digits: FractionDigits;
  /** Renders the buttons for one row, like your own `.unenter` or the host's `.remove`. */
  rowActions: (row: Standing) => JSX.Element;
  /** Renders a first column for the host's mute buttons, left out when not given. */
  muteButton?: ((row: Standing) => JSX.Element) | undefined;
}): JSX.Element {
  return (
    <table class={styles.table} aria-label="Entrants">
      {/* Fixed widths keep the columns still when statuses change length. */}
      <colgroup>
        <Show when={props.muteButton}>
          <col class={styles.muteColumn} />
        </Show>
        <col class={styles.placeColumn} />
        <col />
        <col class={styles.statusColumn} />
        <col class={styles.timeColumn} />
        <col class={styles.actionColumn} />
      </colgroup>
      <thead>
        <tr>
          <Show when={props.muteButton}>
            <th class={styles.headCell} scope="col">
              <span class={styles.visuallyHidden}>Chat</span>
            </th>
          </Show>
          <th class={styles.headCell} scope="col">
            #
          </th>
          <th class={styles.headCell} scope="col">
            Name
          </th>
          <th class={styles.headCell} scope="col">
            Status
          </th>
          <th class={styles.headCell} scope="col">
            Time
          </th>
          <th class={styles.headCell} scope="col">
            <span class={styles.visuallyHidden}>Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(row) => (
            <tr>
              <Show when={props.muteButton}>
                {(muteButton) => <td class={styles.muteCell}>{muteButton()(row)}</td>}
              </Show>
              <td class={styles.placeCell}>{row.place ?? ""}</td>
              <td class={styles.cell}>
                <bdi>{row.name}</bdi>
              </td>
              <td class={styles.cell}>
                <EntrantStatus row={row} started={props.started} />
              </td>
              <td class={styles.timeCell}>
                {row.result?.kind === "done" ? formatClock(row.result.timeMs, props.digits) : ""}
              </td>
              <td class={styles.actionCell}>{props.rowActions(row)}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function EntrantStatus(props: { row: Standing; started: boolean }): JSX.Element {
  const result = () => props.row.result;
  return (
    <Show
      when={result()}
      fallback={
        props.started ? (
          <StatusBadge status="running" label="Racing" />
        ) : (
          <StatusBadge
            status={props.row.ready ? "open" : "countdown"}
            label={props.row.ready ? "Ready" : "Not ready"}
          />
        )
      }
    >
      {(r) => <StatusBadge status={r().kind === "done" ? "done" : "forfeit"} />}
    </Show>
  );
}
