import { For, type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";
import { type FractionDigits, formatClock } from "../../shared/format-time.ts";
import type { Standing } from "../../shared/race/race.ts";
import { StatusBadge } from "../primitives/status-badge.tsx";
import { visuallyHidden } from "../styles/controls.css.ts";
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
  let table: HTMLTableElement | undefined;
  const wide = wideTable(() => table);

  return (
    <table class={styles.table} aria-label="entrants" ref={table}>
      {/* Each head cell sets its column's minimum width, so the columns stay still as cells change. */}
      <thead>
        <tr>
          <Show when={props.muteButton}>
            <th class={styles.headCell} scope="col">
              <span class={visuallyHidden}>chat</span>
            </th>
          </Show>
          <th class={`${styles.headCell} ${styles.placeColumn}`} scope="col">
            #
          </th>
          <th class={`${styles.headCell} ${styles.nameColumn}`} scope="col">
            name
          </th>
          <th class={`${styles.headCell} ${styles.statusColumn}`} scope="col">
            status
          </th>
          <Show when={wide()}>
            <th class={`${styles.headCell} ${styles.timeColumn}`} scope="col">
              time
            </th>
            <th class={`${styles.headCell} ${styles.actionColumn}`} scope="col">
              <span class={visuallyHidden}>actions</span>
            </th>
          </Show>
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
              <td class={styles.nameCell}>
                <bdi>{row.name}</bdi>
                <Show when={!wide()}>
                  <div class={styles.stackedActions}>{props.rowActions(row)}</div>
                </Show>
              </td>
              <Show
                when={wide() || row.result?.kind !== "done"}
                fallback={<td class={styles.timeCell}>{doneTime(row, props.digits)}</td>}
              >
                <td class={styles.cell}>
                  <EntrantStatus row={row} started={props.started} />
                </td>
              </Show>
              <Show when={wide()}>
                <td class={styles.timeCell}>{doneTime(row, props.digits)}</td>
                <td class={styles.actionCell}>{props.rowActions(row)}</td>
              </Show>
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
          <StatusBadge status="running" label="racing" />
        ) : (
          <StatusBadge
            status={props.row.ready ? "open" : "countdown"}
            label={props.row.ready ? "ready" : "not ready"}
          />
        )
      }
    >
      {(r) => <StatusBadge status={r().kind === "done" ? "done" : "forfeit"} />}
    </Show>
  );
}

function doneTime(row: Standing, digits: FractionDigits): string {
  return row.result?.kind === "done" ? formatClock(row.result.timeMs, digits) : "";
}

/**
 * Tracks whether the table's own room fits the Time and row button columns, whatever the screen
 * does around it. In a narrower table a finished entrant's time shows in the Status column and
 * the row buttons sit under the name, so the name keeps 100px. Without a `ResizeObserver`, as
 * in the unit tests, the table counts as wide.
 */
function wideTable(table: () => HTMLTableElement | undefined): () => boolean {
  const [wide, setWide] = createSignal(true);
  onMount(() => {
    const target = table()?.parentElement;
    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }
    const measure = () => setWide(target.clientWidth >= styles.wideTableMinPx);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    onCleanup(() => observer.disconnect());
  });
  return wide;
}
