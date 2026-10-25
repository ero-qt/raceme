import { type ComponentProps, type JSX, createUniqueId, splitProps } from "solid-js";
import * as styles from "./text-field.css.ts";

export interface TextFieldProps extends ComponentProps<"input"> {
  label: string;
}

/** Renders a labeled text input. */
export function TextField(props: TextFieldProps): JSX.Element {
  const [local, rest] = splitProps(props, ["label", "id"]);
  const id = local.id ?? createUniqueId();
  return (
    <div class={styles.field}>
      <label class={styles.label} for={id}>
        {local.label}
      </label>
      <input class={styles.input} id={id} type="text" {...rest} />
    </div>
  );
}
