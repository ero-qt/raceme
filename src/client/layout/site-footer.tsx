import { For, type JSX, Show, createSignal, onCleanup } from "solid-js";
import { catalogCacheHours, sessionCookieDays } from "../../shared/retention.ts";
import { BuildInfoText } from "../home/build-info.tsx";
import * as styles from "./site-footer.css.ts";

interface Note {
  summary: JSX.Element;
  body: () => JSX.Element;
  /** Renders the body only once the note opens, for a body that asks the server for something. */
  loadsOnOpen?: boolean;
}

const notes: Note[] = [
  {
    summary: "privacy",
    body: () => (
      <>
        <p>
          the server keeps nothing on disk. rooms live only in its memory and are gone when they
          close.
        </p>
        <ul>
          <li>
            your browser gets a random cookie so the room knows you after a reload. a host also gets
            a host cookie, whose name contains the room code. both expire after {sessionCookieDays}{" "}
            days and contain no name or other info about you.
          </li>
          <li>
            the server uses your IP address only in memory, to limit rooms, chat, room checks, game
            searches and connections per address or network. it isn't logged or saved.
          </li>
          <li>
            game searches go through the server to speedrun.com, so speedrun.com sees the server and
            never your browser. the server caches the search results in memory for up to{" "}
            {catalogCacheHours} hours.
          </li>
          <li>
            your time digits and recent goals stay in your browser's local storage. after a room
            closes, its results stay in that tab until you close it. none of this reaches the
            server.
          </li>
        </ul>
        <p>there are no accounts, usage stats, ads or trackers.</p>
      </>
    ),
  },
  { summary: "build", body: () => <BuildInfoText />, loadsOnOpen: true },
];

/** Shows short notes about raceme folded away in a bar at the foot of every page. */
export function SiteFooter(): JSX.Element {
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
    <footer class={styles.bar}>
      <div ref={corner} class={styles.inner}>
        <For each={notes}>
          {(note) => {
            const [open, setOpen] = createSignal(false);
            return (
              <details name="site-footer" onToggle={(event) => setOpen(event.currentTarget.open)}>
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
    </footer>
  );
}
