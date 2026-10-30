import { LoaderCircle } from "lucide-solid";
import { type JSX, Show } from "solid-js";
import * as styles from "./home-page.css.ts";

export interface ServerStatus {
  rooms: number;
  people: number;
  /** When a queued restart happens, `null` when none is queued. */
  restartAt: number | null;
}

/** Asks the server for its counts, `null` when it can't answer. */
export async function loadStatusFromServer(): Promise<ServerStatus | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/status`).catch(() => null);
  const body = response?.ok
    ? ((await response.json().catch(() => ({}))) as Partial<Record<keyof ServerStatus, unknown>>)
    : {};
  if (typeof body.rooms !== "number" || typeof body.people !== "number") {
    return null;
  }
  return {
    rooms: body.rooms,
    people: body.people,
    restartAt: typeof body.restartAt === "number" ? body.restartAt : null,
  };
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Shows how many rooms are open and people are online right now. The status is `undefined` until
 * the server first answers and `null` when it can't.
 */
export function ServerStatusCard(props: { status: ServerStatus | null | undefined }): JSX.Element {
  return (
    <section class={styles.card}>
      <h2 class={styles.cardHeading}>server status</h2>
      <Show
        when={props.status}
        fallback={
          <p class={styles.statusLines}>
            <Show when={props.status === undefined} fallback="no answer from the server right now.">
              <LoaderCircle class={styles.spinner} aria-hidden="true" /> loading
            </Show>
          </p>
        }
      >
        {(status) => (
          <p class={styles.statusLines}>
            {status().people} online
            <br />
            {count(status().rooms, "room open", "rooms open")}
          </p>
        )}
      </Show>
    </section>
  );
}
