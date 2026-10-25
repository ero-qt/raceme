import { type ComponentProps, type JSX, createUniqueId, splitProps } from "solid-js";
import * as styles from "./text-field.css.ts";

export interface TextFieldProps extends ComponentProps<"input"> {
  label: string;
  /** Hides the label on screen, for a field whose placeholder already shows what goes in it. */
  hideLabel?: boolean;
}

/** Renders a labeled text input. */
export function TextField(props: TextFieldProps): JSX.Element {
  const [local, rest] = splitProps(props, ["label", "id", "hideLabel"]);
  const id = local.id ?? createUniqueId();
  return (
    <div class={styles.field}>
      <label class={styles.label} for={id} data-hidden={local.hideLabel === true}>
        {local.label}
      </label>
      <input class={styles.input} id={id} type="text" {...rest} />
    </div>
  );
}
