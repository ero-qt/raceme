import { LoaderCircle } from "lucide-solid";
import { type JSX, Show, createSignal } from "solid-js";
import { Button } from "../primitives/button.tsx";
import * as titleStyles from "../room/goal-title.css.ts";
import * as styles from "../room/room.css.ts";
import * as homeStyles from "./home-page.css.ts";
import { useRoomCheck } from "./room-check.ts";
import { parseRoomCode } from "./room-code.ts";

/**
 * Opens a new lobby from a goal or an existing room from a pasted code, in one field. Text shaped
 * like a code only counts as one once the server confirms the room exists, since a goal like
 * `glitchless` has the same shape.
 */
export function HomePage(props: {
  open?: (slug: string) => void;
  /** Shows the start button as busy while the next page loads. */
  busy?: boolean;
  roomExists?: (slug: string) => Promise<boolean>;
  checkDelayMs?: number;
  /** Shows a message from the start, like why the visitor ended up here. */
  notice?: string;
}): JSX.Element {
  const [value, setValue] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(props.notice ?? null);
  const [creating, setCreating] = createSignal(false);
  const busy = () => creating() || props.busy === true;
  document.title = "raceme";

  const roomCheck = useRoomCheck(value, {
    ...(props.roomExists ? { roomExists: props.roomExists } : {}),
    ...(props.checkDelayMs !== undefined ? { delayMs: props.checkDelayMs } : {}),
  });
  const code = () => {
    const slug = parseRoomCode(value());
    return slug !== null && slug === roomCheck.confirmed() ? slug : null;
  };
  const open = (slug: string) =>
    props.open ? props.open(slug) : location.assign(`${import.meta.env.BASE_URL}r/${slug}`);

  /** Joins a live room or opens a lobby. Text shaped like a code waits for the room check. */
  async function submit(): Promise<void> {
    const slug = parseRoomCode(value());
    if (slug === null) {
      return startRace();
    }
    if (slug === roomCheck.confirmed()) {
      return open(slug);
    }

    const exists = await roomCheck.checkNow(slug);
    if (exists === null) {
      setNotice("Couldn't check that room code. Try again.");
    } else if (exists) {
      open(slug);
    } else {
      await startRace();
    }
  }

  async function startRace(): Promise<void> {
    setCreating(true);
    const response = await fetch(`${import.meta.env.BASE_URL}api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: value() }),
    }).catch(() => null);

    if (!response?.ok) {
      setCreating(false);
      setNotice(failureText(response?.status ?? null));
      return;
    }

    const { slug } = (await response.json()) as { slug: string };
    open(slug);
  }

  return (
    <main class={styles.page}>
      <h1 class={homeStyles.visuallyHidden}>raceme</h1>
      <form
        class={titleStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div class={titleStyles.goal}>
          <input
            class={`${titleStyles.input} ${homeStyles.field}`}
            aria-label="Goal or room code"
            placeholder="set a goal or paste a room code"
            maxLength={200}
            autocomplete="off"
            spellcheck={false}
            data-kind={code() ? "code" : "goal"}
            onInput={(e) => setValue(e.currentTarget.value)}
          />
        </div>
        <Show
          when={code()}
          fallback={
            <Button type="submit" disabled={busy() || value().trim() === ""} aria-busy={busy()}>
              <Show when={busy()}>
                <LoaderCircle class={homeStyles.spinner} aria-hidden="true" />
              </Show>
              .startrace
            </Button>
          }
        >
          <Button type="submit" variant="ghost">
            join
          </Button>
        </Show>
      </form>
      <p class={styles.notice} role="status">
        {notice()}
      </p>
    </main>
  );
}

/** Explains a failed room creation. Without a status the request never reached the server. */
function failureText(status: number | null): string {
  if (status === 400) {
    return "The goal needs 1 to 200 characters.";
  }
  return status === 429 ? "Too many new rooms. Try again in a minute." : "Couldn't open a room.";
}
