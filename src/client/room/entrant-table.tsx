import { For, type JSX, Show, createSignal, onCleanup } from "solid-js";
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
  const wide = wideScreen();

  return (
    <table class={styles.table} aria-label="entrants">
      {/* Fixed widths keep the columns still when statuses change length. */}
      <colgroup>
        <Show when={props.muteButton}>
          <col class={styles.muteColumn} />
        </Show>
        <col class={styles.placeColumn} />
        <col />
        <col class={styles.statusColumn} />
        <Show when={wide()}>
          <col class={styles.timeColumn} />
          <col class={styles.actionColumn} />
        </Show>
      </colgroup>
      <thead>
        <tr>
          <Show when={props.muteButton}>
            <th class={styles.headCell} scope="col">
              <span class={styles.visuallyHidden}>chat</span>
            </th>
          </Show>
          <th class={styles.headCell} scope="col">
            #
          </th>
          <th class={styles.headCell} scope="col">
            name
          </th>
          <th class={styles.headCell} scope="col">
            status
          </th>
          <Show when={wide()}>
            <th class={styles.headCell} scope="col">
              time
            </th>
            <th class={styles.headCell} scope="col">
              <span class={styles.visuallyHidden}>actions</span>
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
              <td class={styles.cell}>
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
 * Tracks whether the screen has room for the Time and row button columns. On a phone a finished
 * entrant's time shows in the Status column and the row buttons sit under the name.
 */
function wideScreen(): () => boolean {
  const query = globalThis.matchMedia?.("(min-width: 40rem)");
  const [wide, setWide] = createSignal(query?.matches ?? true);
  const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
  query?.addEventListener("change", onChange);
  onCleanup(() => query?.removeEventListener("change", onChange));
  return wide;
}
