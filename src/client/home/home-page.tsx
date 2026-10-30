import { LoaderCircle, TriangleAlert } from "lucide-solid";
import { type JSX, Show, createSignal, onCleanup } from "solid-js";
import { solveChallenge } from "../../shared/proof-of-work.ts";
import { Button } from "../primitives/button.tsx";
import { refusalText } from "../room/action-labels.ts";
import * as titleStyles from "../room/goal-title.css.ts";
import * as styles from "../room/room.css.ts";
import { type CatalogEntry, loadCategoriesFromServer, searchGamesOnServer } from "./game-search.ts";
import { rememberGoal } from "./goal-history.ts";
import { GoalPicker, useGamePicker } from "./goal-picker.tsx";
import { HomeIntro } from "./home-intro.tsx";
import * as homeStyles from "./home-page.css.ts";
import { useRoomCheck } from "./room-check.ts";
import { parseRoomCode } from "./room-code.ts";
import { type ServerStatus, ServerStatusCard, loadStatusFromServer } from "./server-status.tsx";

// The counts on the start page refresh this often, which is cheap and feels live enough.
const statusEveryMs = 30_000;

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
  searchGames?: (query: string) => Promise<CatalogEntry[] | null>;
  loadCategories?: (gameId: string) => Promise<CatalogEntry[]>;
  searchDelayMs?: number;
  /** Asks the server for its open rooms, people online and queued restart. */
  loadStatus?: () => Promise<ServerStatus | null>;
  statusEveryMs?: number;
}): JSX.Element {
  const [value, setValue] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(props.notice ?? null);
  const [creating, setCreating] = createSignal(false);
  const busy = () => creating() || props.busy === true;
  const [status, setStatus] = createSignal<ServerStatus | null | undefined>(undefined);
  const loadStatus = props.loadStatus ?? loadStatusFromServer;
  const [now, setNow] = createSignal(Date.now());
  const pollStatus = () => {
    setNow(Date.now());
    void loadStatus().then(setStatus);
  };
  pollStatus();
  const statusTimer = setInterval(pollStatus, props.statusEveryMs ?? statusEveryMs);
  onCleanup(() => clearInterval(statusTimer));
  const restartAt = () => status()?.restartAt ?? null;
  document.title = "raceme";

  const roomCheck = useRoomCheck(value, {
    ...(props.roomExists ? { roomExists: props.roomExists } : {}),
    ...(props.checkDelayMs !== undefined ? { delayMs: props.checkDelayMs } : {}),
  });
  // A pasted code is hidden at once instead of after the check, so it doesn't sit on screen.
  // It shows again if the check finds no such room.
  const [pastedCode, setPastedCode] = createSignal<string | null>(null);
  let pasting = false;
  const code = () => {
    const slug = parseRoomCode(value());
    const pasted = slug === pastedCode() && slug !== roomCheck.absent();
    return slug !== null && (slug === roomCheck.confirmed() || pasted) ? slug : null;
  };
  const changeValue = (text: string) => {
    setValue(text);
    if (!pasting) {
      return;
    }

    pasting = false;
    const slug = parseRoomCode(text);
    setPastedCode(slug);
    if (slug) {
      void roomCheck.checkNow(slug);
    }
  };
  const picker = useGamePicker(value, {
    noRoomHasCode: roomCheck.absent,
    searchGames: props.searchGames ?? searchGamesOnServer,
    loadCategories: props.loadCategories ?? loadCategoriesFromServer,
    ...(props.searchDelayMs !== undefined ? { delayMs: props.searchDelayMs } : {}),
  });

  const open = (slug: string) =>
    props.open ? props.open(slug) : location.assign(`${import.meta.env.BASE_URL}${slug}`);

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
      setNotice("couldn't check that room code. try again.");
    } else if (exists) {
      open(slug);
    } else {
      await startRace();
    }
  }

  async function startRace(): Promise<void> {
    setCreating(true);
    // A proxy error page in place of the JSON reply makes `json()` throw.
    await createRoom().catch(() => {
      setCreating(false);
      setNotice(failureText(null));
    });
  }

  async function createRoom(): Promise<void> {
    let response = await requestRoom(picker.goal(), null);

    // During a rush of new rooms the server asks for a proof of work first.
    if (response?.status === 428) {
      setNotice("lots of rooms are being opened right now. please wait a few seconds…");
      const { challenge } = (await response.json()) as { challenge: Challenge };
      // Browsers only offer crypto.subtle on https pages, so solving can fail on plain http.
      const nonce = await solveChallenge(challenge.token, challenge.bits).catch(() => null);
      setNotice(null);
      response =
        nonce === null ? null : await requestRoom(picker.goal(), { token: challenge.token, nonce });
    }

    if (!response?.ok) {
      setCreating(false);
      setNotice(failureText(response?.status ?? null));
      return;
    }

    const { slug } = (await response.json()) as { slug: string };
    rememberGoal(picker.goal());
    open(slug);
  }

  return (
    <main class={homeStyles.page}>
      <section class={homeStyles.start}>
        <h1 class={homeStyles.visuallyHidden}>raceme</h1>
        <form
          class={titleStyles.form}
          onPaste={() => {
            pasting = true;
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <GoalPicker
            picker={picker}
            label="goal or room code"
            placeholder="set a goal or paste a room code"
            inputClass={`${titleStyles.input} ${homeStyles.field}`}
            kind={code() ? "code" : "goal"}
            value={value()}
            onInput={changeValue}
          />
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
      </section>
      <aside class={homeStyles.side}>
        <HomeIntro />
        <ServerStatusCard status={status()}>
          <Show when={restartAt()}>
            {(at) => (
              <p class={`${styles.notice} ${homeStyles.warning}`}>
                <TriangleAlert class={styles.closedIcon} aria-hidden="true" />
                {restartText(at(), now())}
              </p>
            )}
          </Show>
        </ServerStatusCard>
      </aside>
    </main>
  );
}

/** Writes the notice for a queued restart, like `... at 10:00 UTC (in 3 h 20 min)!`. */
function restartText(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((at - now) / 60_000));
  const time = new Date(at).toISOString().slice(11, 16);
  return `all rooms will be closed for a server restart at ${time} UTC (in ${Math.floor(minutes / 60)} h ${minutes % 60} min)!`;
}

interface Challenge {
  token: string;
  bits: number;
}

function requestRoom(goal: string, proof: { token: string; nonce: number } | null) {
  return fetch(`${import.meta.env.BASE_URL}api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof === null ? { goal } : { goal, proof }),
  }).catch(() => null);
}

/** Explains a failed room creation. Without a status the request never reached the server. */
function failureText(status: number | null): string {
  if (status === 400) {
    return refusalText.badGoal;
  }
  return status === 429 ? "too many new rooms. try again in a minute." : "couldn't open a room.";
}
