import { type JSX, Show, createEffect, createSignal, on } from "solid-js";
import { rememberGoal } from "../goal/goal-history.ts";
import {
  type GoalCatalog,
  GoalPicker,
  serverCatalog,
  useGamePicker,
} from "../goal/goal-picker.tsx";
import * as styles from "../goal/goal-title.css.ts";
import { Button } from "../primitives/button.tsx";
import { visuallyHidden } from "../styles/controls.css.ts";

/**
 * Shows the goal as the page title. For the host the goal is an input that looks like plain text
 * until hovered or focused, with the same suggestions as the start page. Enter sets the goal and
 * Escape puts it back.
 */
export function GoalTitle(props: {
  goal: string | null;
  editable: boolean;
  onSubmit: (goal: string) => void;
  catalog?: GoalCatalog | undefined;
}): JSX.Element {
  return (
    <Show when={props.editable} fallback={<h1 class={styles.plainGoal}>{props.goal}</h1>}>
      <EditableGoal goal={props.goal} onSubmit={props.onSubmit} catalog={props.catalog} />
    </Show>
  );
}

function EditableGoal(props: {
  goal: string | null;
  onSubmit: (goal: string) => void;
  catalog: GoalCatalog | undefined;
}): JSX.Element {
  const [draft, setDraft] = createSignal(props.goal ?? "");
  const [editing, setEditing] = createSignal(false);
  const picker = useGamePicker(draft, props.catalog ?? serverCatalog);

  createEffect(
    on(
      () => props.goal,
      (goal) => setDraft(goal ?? ""),
    ),
  );

  // Focus stays in the field after Enter or Escape, so Tab goes on from the goal.
  const putBack = () => {
    setDraft(props.goal ?? "");
    setEditing(false);
  };

  return (
    <form
      class={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const goal = picker.goal();
        props.onSubmit(goal);
        rememberGoal(goal);
        setEditing(false);
      }}
      // Leaving the input for .setgoal keeps editing, so Tab can reach the button.
      onFocusOut={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setEditing(false);
          setDraft(props.goal ?? "");
        }
      }}
    >
      {/* The list of suggestions can't sit inside a heading, so the heading for the goal stays hidden. */}
      <h1 class={visuallyHidden}>{props.goal}</h1>
      <GoalPicker
        picker={picker}
        label="goal"
        inputClass={styles.input}
        value={draft()}
        onInput={(text) => {
          setDraft(text);
          setEditing(true);
        }}
        onFocus={(input) => {
          setEditing(true);
          input.select();
        }}
        onEscape={putBack}
      />
      <Show when={editing()}>
        <Button type="submit" onPointerDown={(event) => event.preventDefault()}>
          .setgoal
        </Button>
      </Show>
    </form>
  );
}
