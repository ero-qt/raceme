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
          raceme doesn't save anything about you. a room only exists while it's open. when it
          closes, all data about it is deleted.
        </p>
        <ul>
          <li>
            you get a cookie so a room still knows who you are after a reload. if you made the room,
            you get a second cookie that marks you as the host. neither one has your name in it.
            both are deleted after {sessionCookieDays} days.
          </li>
          <li>
            the server uses your IP address to stop one person from opening tons of rooms or
            spamming chat. it is forgotten a few minutes after you leave and never saved on the
            server.
          </li>
          <li>
            when you search for a game, the server does the search for you, so the site it searches
            never sees you. the answers are kept for up to {catalogCacheHours} hours so the next
            person gets them faster.
          </li>
          <li>
            your clock setting, your recent goals and the results of a room you were in stay in your
            browser only. none of that is sent anywhere.
          </li>
        </ul>
        <p>no accounts, no ads, no trackers.</p>
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
