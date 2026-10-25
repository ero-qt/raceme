import { For, type JSX, Show, createSignal } from "solid-js";
import * as titleStyles from "../room/goal-title.css.ts";
import {
  type CatalogEntry,
  loadCategoriesFromServer,
  searchGamesOnServer,
  useGameSearch,
} from "./game-search.ts";
import { forgetGoal, loadGoalHistory } from "./goal-history.ts";
import * as styles from "./goal-picker.css.ts";
import { parseRoomCode } from "./room-code.ts";
import { SuggestionBox, type SuggestionGroup } from "./suggestion-box.tsx";

/** Looks up speedrun.com games and categories for the picker. */
export interface GoalCatalog {
  searchGames: (query: string) => Promise<CatalogEntry[] | null>;
  loadCategories: (gameId: string) => Promise<CatalogEntry[]>;
  delayMs?: number;
}

export const serverCatalog: GoalCatalog = {
  searchGames: searchGamesOnServer,
  loadCategories: loadCategoriesFromServer,
};

const maxHistoryShown = 5;
// Same limit the race rules set for a goal.
const maxGoalLength = 200;
const typedOptionId = "typed";

/**
 * Builds a goal field's suggestions from this browser's past goals and from speedrun.com games.
 * It also keeps track of a picked game and its category.
 */
export function useGamePicker(
  text: () => string,
  options: GoalCatalog & {
    /** Gives code-shaped text once the server confirmed no room has that code. */
    noRoomHasCode?: () => string | null;
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
    return code === null || code === options.noRoomHasCode?.() ? text() : null;
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
    /** Gives the goal to set, the game and category joined when both are picked. */
    goal: () => {
      const current = picked();
      const joined = current && category() ? `${current.name} - ${category()}` : text();
      return joined.slice(0, maxGoalLength);
    },
  };
}

export type GamePicker = ReturnType<typeof useGamePicker>;

/** Shows the goal field with its suggestions, plus a category select once a game is picked. */
export function GoalPicker(props: {
  picker: GamePicker;
  label: string;
  value: string;
  onInput: (text: string) => void;
  placeholder?: string;
  inputClass?: string;
  kind?: string;
  onFocus?: (input: HTMLInputElement) => void;
  onEscape?: () => void;
}): JSX.Element {
  return (
    <>
      <div class={titleStyles.goal}>
        <SuggestionBox
          label={props.label}
          placeholder={props.placeholder}
          maxLength={maxGoalLength}
          inputClass={props.inputClass}
          kind={props.kind}
          value={props.value}
          groups={props.picker.groups()}
          onInput={props.onInput}
          onPick={(option, group) => {
            if (!option.typed) {
              props.onInput(option.label);
            }
            props.picker.pick(option, group);
          }}
          onRemove={(option) => props.picker.forget(option.label)}
          onFoldChange={(groupId, folded) =>
            groupId === "speedrun" && props.picker.setSpeedrunOpen(!folded)
          }
          onFocus={props.onFocus}
          onEscape={props.onEscape}
        />
      </div>
      <Show when={props.picker.categories().length > 0}>
        <select
          class={styles.category}
          aria-label="Category"
          value={props.picker.category()}
          onChange={(event) => props.picker.setCategory(event.currentTarget.value)}
        >
          <option value="">No category</option>
          <For each={props.picker.categories()}>
            {(category) => <option value={category.name}>{category.name}</option>}
          </For>
        </select>
      </Show>
    </>
  );
}
