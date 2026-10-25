import { ChevronDown, ChevronRight, Plus, X } from "lucide-solid";
import { For, type JSX, Show, createMemo, createSignal, createUniqueId } from "solid-js";
import { visuallyHidden } from "./home-page.css.ts";
import * as styles from "./suggestion-box.css.ts";

export interface SuggestionOption {
  id: string;
  label: string;
  /** Lets the viewer delete the option, like a goal from their own history. */
  removable?: boolean;
  /** Marks the row that stands for the field's own text, shown with a plus. */
  typed?: boolean;
}

export interface SuggestionGroup {
  id: string;
  /** Shows where the options come from, like `speedrun.com`. */
  label: string;
  options: SuggestionOption[];
  /** Starts folded and stays listed while empty, for a source that's only asked once unfolded. */
  startsFolded?: boolean;
}

type Row =
  | { kind: "header"; group: SuggestionGroup; collapsed: boolean }
  | { kind: "option"; group: SuggestionGroup; option: SuggestionOption };

/**
 * Shows a text field with suggestions grouped by source, following the ARIA 1.2 combobox
 * pattern. Arrow keys move through options and group headers, Enter picks an option or folds a
 * group, Delete removes a removable option and Escape closes the list.
 */
export function SuggestionBox(props: {
  label: string;
  groups: SuggestionGroup[];
  onInput: (text: string) => void;
  onPick: (option: SuggestionOption, group: SuggestionGroup) => void;
  onRemove: (option: SuggestionOption, group: SuggestionGroup) => void;
  value?: string;
  placeholder?: string;
  maxLength?: number;
  inputClass?: string;
  /** Sets `data-kind` on the field, for styling a room code differently from a goal. */
  kind?: string;
  onFoldChange?: (groupId: string, folded: boolean) => void;
}): JSX.Element {
  const listId = createUniqueId();
  const hintId = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [folded, setFolded] = createSignal<ReadonlySet<string>>(new Set());
  const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>(new Set());
  const isFolded = (group: SuggestionGroup) =>
    folded().has(group.id) || (group.startsFolded === true && !unfolded().has(group.id));
  const [announcement, setAnnouncement] = createSignal("");

  const visibleGroups = createMemo(() =>
    props.groups.filter((group) => group.options.length > 0 || group.startsFolded),
  );
  const rows = createMemo(() =>
    visibleGroups().flatMap((group) => groupRows(group, isFolded(group))),
  );
  const labelId = (group: SuggestionGroup) => `${listId}-${group.id}`;
  const expanded = () => open() && rows().length > 0;
  const active = () => (expanded() ? rows()[activeIndex()] : undefined);
  const rowId = (index: number) => `${listId}-${index}`;

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };
  const move = (step: number) => {
    setOpen(true);
    const count = rows().length;
    if (count > 0) {
      // Index -1 is the field itself, so moving past either end comes back to it.
      setActiveIndex((current) => ((current + 1 + step + count + 1) % (count + 1)) - 1);
    }
  };
  const toggle = (group: SuggestionGroup) => {
    const fold = !isFolded(group);
    setFolded(withOrWithout(folded(), group.id, fold));
    setUnfolded(withOrWithout(unfolded(), group.id, !fold));
    props.onFoldChange?.(group.id, fold);
  };
  const pick = (row: OptionRow) => {
    props.onPick(row.option, row.group);
    close();
  };
  const remove = (row: OptionRow) => {
    props.onRemove(row.option, row.group);
    setAnnouncement(`Removed ${row.option.label}.`);
    setActiveIndex((current) => Math.min(current, rows().length - 1));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const row = active();
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        break;
      case "Enter":
        if (row) {
          event.preventDefault();
          row.kind === "header" ? toggle(row.group) : pick(row);
        }
        break;
      case "Delete":
        if (row?.kind === "option" && row.option.removable) {
          event.preventDefault();
          remove(row);
        }
        break;
      case "Escape":
        if (expanded()) {
          event.preventDefault();
          close();
        }
        break;
    }
  };

  return (
    <div class={styles.box}>
      <input
        class={props.inputClass}
        role="combobox"
        aria-label={props.label}
        aria-autocomplete="list"
        aria-expanded={expanded()}
        aria-controls={listId}
        aria-activedescendant={active() ? rowId(activeIndex()) : undefined}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        value={props.value ?? ""}
        autocomplete="off"
        spellcheck={false}
        data-kind={props.kind}
        onInput={(event) => {
          props.onInput(event.currentTarget.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        onClick={() => setOpen(true)}
        onBlur={close}
      />
      <Show when={expanded()}>
        <div id={listId} class={styles.list} role="listbox" aria-label="Suggestions">
          <For each={visibleGroups()}>
            {(group) => (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset can't sit inside a listbox
              <div role="group" aria-labelledby={labelId(group)}>
                <For each={rows()}>
                  {(row, index) => (
                    <Show when={row.group.id === group.id}>
                      <SuggestionRow
                        row={row}
                        id={rowId(index())}
                        active={index() === activeIndex()}
                        hintId={hintId}
                        labelId={labelId(group)}
                        onToggle={() => toggle(group)}
                        onPick={pick}
                        onRemove={remove}
                      />
                    </Show>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
      <span id={hintId} class={visuallyHidden}>
        Press Delete to remove this goal.
      </span>
      <span class={visuallyHidden} aria-live="polite">
        {announcement()}
      </span>
    </div>
  );
}

type OptionRow = Extract<Row, { kind: "option" }>;

/** Draws one row of the list, which is either a group header or an option. */
function SuggestionRow(props: {
  row: Row;
  id: string;
  active: boolean;
  /** Points removable options at the text explaining the Delete key. */
  hintId: string;
  /** Gives the header's label an id, so the group takes its name from it. */
  labelId: string;
  onToggle: () => void;
  onPick: (row: OptionRow) => void;
  onRemove: (row: OptionRow) => void;
}): JSX.Element {
  // Keeps focus in the field, so the list stays open.
  const keepFocus = (event: MouseEvent) => event.preventDefault();
  const row = props.row;

  if (row.kind === "header") {
    return (
      // biome-ignore lint/a11y/useFocusableInteractive: the field keeps focus and points here with aria-activedescendant
      // biome-ignore lint/a11y/useKeyWithClickEvents: the field handles the keys for every row
      <div
        id={props.id}
        role="option"
        aria-selected="false"
        class={styles.header}
        data-active={props.active}
        onMouseDown={keepFocus}
        onClick={() => props.onToggle()}
      >
        <span class={styles.label}>
          {row.collapsed ? (
            <ChevronRight class={styles.icon} aria-hidden="true" />
          ) : (
            <ChevronDown class={styles.icon} aria-hidden="true" />
          )}
          <span id={props.labelId}>{row.group.label}</span>
          <span class={visuallyHidden}>{headerState(row.group, row.collapsed)}</span>
        </span>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the field keeps focus and points here with aria-activedescendant
    // biome-ignore lint/a11y/useKeyWithClickEvents: the field handles the keys for every row
    <div
      id={props.id}
      role="option"
      aria-selected={props.active}
      aria-describedby={row.option.removable ? props.hintId : undefined}
      class={styles.option}
      data-active={props.active}
      data-typed={row.option.typed === true}
      data-removable={row.option.removable === true}
      onMouseDown={keepFocus}
      onClick={() => props.onPick(row)}
    >
      <Show when={row.option.typed} fallback={<span>{row.option.label}</span>}>
        <span class={styles.typed}>
          <Plus class={styles.icon} aria-hidden="true" />
          <span class={visuallyHidden}>use </span>
          {row.option.label}
          <span class={visuallyHidden}> as the goal</span>
        </span>
      </Show>
      <Show when={row.option.removable}>
        <span
          class={styles.remove}
          title="Remove from your goals"
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            props.onRemove(row);
          }}
        >
          <X class={styles.icon} />
        </span>
      </Show>
    </div>
  );
}

function withOrWithout(set: ReadonlySet<string>, id: string, include: boolean): Set<string> {
  const next = new Set(set);
  if (include) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

function groupRows(group: SuggestionGroup, isCollapsed: boolean): Row[] {
  const header: Row = { kind: "header", group, collapsed: isCollapsed };
  return isCollapsed
    ? [header]
    : [header, ...group.options.map((option) => ({ kind: "option" as const, group, option }))];
}

// ARIA doesn't allow `aria-expanded` on an option, so hidden text after the header's label
// states whether the group is folded.
function headerState(group: SuggestionGroup, isCollapsed: boolean): string {
  const size = group.options.length;
  const count = size === 0 ? "" : `, ${size} ${size === 1 ? "result" : "results"}`;
  return `${count}, ${isCollapsed ? "folded, Enter unfolds" : "Enter folds"}`;
}
