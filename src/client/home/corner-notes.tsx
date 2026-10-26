import { For, type JSX, Show, createSignal, onCleanup } from "solid-js";
import { catalogCacheHours, sessionCookieDays } from "../../shared/retention.ts";
import { BuildInfoText } from "./build-info.tsx";
import * as styles from "./corner-notes.css.ts";

interface Note {
  summary: JSX.Element;
  body: () => JSX.Element;
  /** Renders the body only once the note opens, for a body that asks the server for something. */
  loadsOnOpen?: boolean;
}

const notes: Note[] = [
  {
    summary: "Privacy",
    body: () => (
      <>
        <p>
          The server keeps nothing on disk. Rooms live only in its memory and are gone when they
          close.
        </p>
        <ul>
          <li>
            Your browser gets a random cookie so the room knows you after a reload. A host also gets
            a host cookie, whose name contains the room code. Both expire after {sessionCookieDays}{" "}
            days and contain no name or other info about you.
          </li>
          <li>
            The server uses your IP address only in memory, to limit rooms, chat, room checks, game
            searches and connections per address or network. It isn't logged or saved.
          </li>
          <li>
            Game searches go through the server to speedrun.com, so speedrun.com sees the server and
            never your browser. The server keeps the answers in memory for up to {catalogCacheHours}{" "}
            hours and then drops them.
          </li>
          <li>
            Your theme, time digits and recent goals stay in your browser's local storage. After a
            room closes, its results stay in that tab until you close it. None of this reaches the
            server.
          </li>
        </ul>
        <p>
          The server tells its owner on Discord when the number of open rooms or people online
          passes 5, 10, 25, 50 and so on. That message contains only the number.
        </p>
        <p>There are no accounts, usage stats, ads or trackers.</p>
      </>
    ),
  },
  {
    summary: "Made with AI",
    body: () => (
      <p>
        raceme was made with a lot of help from AI.
        <br />
        reproducing, rewriting, rehosting encouraged.
        <br />
        i'm not proud, but i think it's useful.
      </p>
    ),
  },
  { summary: "Build", body: () => <BuildInfoText />, loadsOnOpen: true },
];

/** Shows short notes about raceme folded away in a corner of the start page. */
export function CornerNotes(): JSX.Element {
  let corner!: HTMLDivElement;
  const closeAll = () => {
    for (const note of corner.querySelectorAll("details[open]")) {
      note.removeAttribute("open");
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!corner.contains(event.target as Node)) {
      closeAll();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeAll();
    }
  };
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div ref={corner} class={styles.corner}>
      <For each={notes}>
        {(note) => {
          const [open, setOpen] = createSignal(false);
          return (
            <details name="corner-notes" onToggle={(event) => setOpen(event.currentTarget.open)}>
              <summary class={styles.summary}>{note.summary}</summary>
              <Show when={open() || !note.loadsOnOpen}>
                {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs focus */}
                <div class={styles.text} tabIndex={0}>
                  {note.body()}
                </div>
              </Show>
            </details>
          );
        }}
      </For>
    </div>
  );
}
