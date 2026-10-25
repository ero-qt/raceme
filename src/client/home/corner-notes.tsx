import { For, type JSX } from "solid-js";
import * as styles from "./corner-notes.css.ts";

interface Note {
  summary: JSX.Element;
  body: () => JSX.Element;
}

const notes: Note[] = [
  {
    summary: "privacy",
    body: () => (
      <>
        <p>
          raceme doesn't store anything. Rooms live only in the server's memory and are gone when
          they close.
        </p>
        <ul>
          <li>
            Your browser gets a random cookie so the room knows you after a reload. A host also gets
            a host cookie. Both expire after 30 days and hold no name or other info about you.
          </li>
          <li>
            The server uses your IP address only in memory, to limit how many rooms and connections
            one address opens. It isn't logged or saved.
          </li>
          <li>
            Game searches go through the server to speedrun.com, so speedrun.com sees the server and
            never your browser. Results are kept in memory for up to a day.
          </li>
          <li>
            Your theme, time digits and recent goals stay in your browser's local storage and never
            reach the server.
          </li>
        </ul>
        <p>There are no accounts, usage stats, ads or trackers.</p>
      </>
    ),
  },
];

/** Shows short notes about raceme folded away in a corner of the start page. */
export function CornerNotes(): JSX.Element {
  return (
    <div class={styles.corner}>
      <For each={notes}>
        {(note) => (
          <details class={styles.note}>
            <summary class={styles.summary}>{note.summary}</summary>
            <div class={styles.text}>{note.body()}</div>
          </details>
        )}
      </For>
    </div>
  );
}
