import { LoaderCircle } from "lucide-solid";
import { For, type JSX, Show, createSignal } from "solid-js";
import { Button } from "../primitives/button.tsx";
import * as titleStyles from "../room/goal-title.css.ts";
import * as styles from "../room/room.css.ts";
import {
  type CatalogEntry,
  loadCategoriesFromServer,
  searchGamesOnServer,
  useGameSearch,
} from "./game-search.ts";
import { forgetGoal, loadGoalHistory, rememberGoal } from "./goal-history.ts";
import * as homeStyles from "./home-page.css.ts";
import { useRoomCheck } from "./room-check.ts";
import { parseRoomCode } from "./room-code.ts";
import { SuggestionBox, type SuggestionGroup } from "./suggestion-box.tsx";

const maxHistoryShown = 5;
// Same limit the race rules set for a goal.
const maxGoalLength = 200;
const typedOptionId = "typed";

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
  const picker = useGamePicker(value, {
    noRoomHasCode: roomCheck.absent,
    searchGames: props.searchGames ?? searchGamesOnServer,
    loadCategories: props.loadCategories ?? loadCategoriesFromServer,
    ...(props.searchDelayMs !== undefined ? { delayMs: props.searchDelayMs } : {}),
  });

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
      body: JSON.stringify({ goal: picker.goal() }),
    }).catch(() => null);

    if (!response?.ok) {
      setCreating(false);
      setNotice(failureText(response?.status ?? null));
      return;
    }

    rememberGoal(picker.goal());
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
          <SuggestionBox
            label="Goal or room code"
            placeholder="set a goal or paste a room code"
            maxLength={200}
            inputClass={`${titleStyles.input} ${homeStyles.field}`}
            kind={code() ? "code" : "goal"}
            value={value()}
            groups={picker.groups()}
            onInput={setValue}
            onPick={(option, group) => {
              if (!option.typed) {
                setValue(option.label);
              }
              picker.pick(option, group);
            }}
            onRemove={(option) => picker.forget(option.label)}
            onFoldChange={(groupId, folded) =>
              groupId === "speedrun" && picker.setSpeedrunOpen(!folded)
            }
          />
        </div>
        <Show when={picker.categories().length > 0}>
          <select
            class={homeStyles.category}
            aria-label="Category"
            value={picker.category()}
            onChange={(event) => picker.setCategory(event.currentTarget.value)}
          >
            <option value="">no category</option>
            <For each={picker.categories()}>
              {(category) => <option value={category.name}>{category.name}</option>}
            </For>
          </select>
        </Show>
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

/**
 * Builds the start field's suggestions from this browser's past goals and from speedrun.com
 * games. It also keeps track of a picked game and its category.
 */
function useGamePicker(
  text: () => string,
  options: {
    /** Gives code-shaped text once the server confirmed no room has that code. */
    noRoomHasCode: () => string | null;
    searchGames: (query: string) => Promise<CatalogEntry[] | null>;
    loadCategories: (gameId: string) => Promise<CatalogEntry[]>;
    delayMs?: number;
  },
) {
  const [history, setHistory] = createSignal(loadGoalHistory());
  const [game, setGame] = createSignal<CatalogEntry | null>(null);
  const [categories, setCategories] = createSignal<CatalogEntry[]>([]);
  const [category, setCategory] = createSignal("");
  const [speedrunOpen, setSpeedrunOpen] = createSignal(false);

  // A pasted room code must never reach speedrun.com, so code-shaped text only counts as a goal
  // once the server confirmed no room has that code.
  const searchable = () => {
    const code = parseRoomCode(text());
    return code === null || code === options.noRoomHasCode() ? text() : null;
  };
  // speedrun.com starts folded and is only asked once someone opens it.
  const games = useGameSearch(() => (speedrunOpen() ? searchable() : null), {
    searchGames: options.searchGames,
    ...(options.delayMs !== undefined ? { delayMs: options.delayMs } : {}),
  });

  // The picked game only counts while the field still shows its name.
  const picked = () => {
    const current = game();
    return current !== null && current.name === text() ? current : null;
  };

  const groups = (): SuggestionGroup[] => {
    const typed = searchable()?.trim();
    if (typed === undefined) {
      return [];
    }

    const query = typed.toLowerCase();
    const pastGoals = history()
      .filter((goal) => goal.toLowerCase().includes(query))
      .slice(0, maxHistoryShown)
      .map((goal) => ({ id: goal, label: goal, removable: true }));
    // The field's own text closes the list of goals, so it's clear any goal works.
    const isKnown = history().some((goal) => goal.toLowerCase() === query);
    const ownText =
      typed === "" || isKnown ? [] : [{ id: typedOptionId, label: typed, typed: true }];
    const found = games().map((entry) => ({ id: entry.id, label: entry.name }));
    return [
      { id: "history", label: "your goals", options: [...pastGoals, ...ownText] },
      { id: "speedrun", label: "speedrun.com", options: found, startsFolded: true },
    ];
  };

  const pick = async (option: { id: string; label: string }, group: SuggestionGroup) => {
    setCategory("");
    setCategories([]);
    if (group.id !== "speedrun") {
      setGame(null);
      return;
    }

    setGame({ id: option.id, name: option.label });
    const loaded = await options.loadCategories(option.id);
    if (game()?.id === option.id) {
      setCategories(loaded);
    }
  };

  const forget = (goal: string) => {
    forgetGoal(goal);
    setHistory(loadGoalHistory());
  };

  return {
    groups,
    pick,
    forget,
    categories: () => (picked() ? categories() : []),
    category: () => (picked() ? category() : ""),
    setCategory,
    setSpeedrunOpen,
    /** Gives the goal to open the room with, the game and category joined when both are picked. */
    goal: () => {
      const current = picked();
      const joined = current && category() ? `${current.name} - ${category()}` : text();
      return joined.slice(0, maxGoalLength);
    },
  };
}
