import { type JSX, Show, createEffect, createSignal, on } from "solid-js";
import { Button } from "../primitives/button.tsx";
import * as styles from "./goal-title.css.ts";

/**
 * Shows the goal as the page title. For the host the title is itself an input that looks like
 * plain text until hovered or focused, Enter sets the goal and Escape puts it back.
 */
export function GoalTitle(props: {
  goal: string | null;
  editable: boolean;
  onSubmit: (goal: string) => void;
}): JSX.Element {
  const [draft, setDraft] = createSignal(props.goal ?? "");
  const [editing, setEditing] = createSignal(false);

  createEffect(
    on(
      () => props.goal,
      (goal) => setDraft(goal ?? ""),
    ),
  );

  return (
    <Show when={props.editable} fallback={<h1 class={styles.goal}>{props.goal}</h1>}>
      <form
        class={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit(draft());
          (document.activeElement as HTMLElement | null)?.blur();
        }}
        // Leaving the input for .setgoal keeps editing, so Tab can reach the button.
        onFocusOut={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setEditing(false);
            setDraft(props.goal ?? "");
          }
        }}
      >
        <h1 class={styles.goal}>
          <input
            class={styles.input}
            aria-label="Goal"
            maxLength={200}
            value={draft()}
            onFocus={(e) => {
              setEditing(true);
              e.currentTarget.select();
            }}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(props.goal ?? "");
                e.currentTarget.value = props.goal ?? "";
                e.currentTarget.blur();
              }
            }}
          />
        </h1>
        <Show when={editing()}>
          <Button type="submit" onPointerDown={(event) => event.preventDefault()}>
            .setgoal
          </Button>
        </Show>
      </form>
    </Show>
  );
}
