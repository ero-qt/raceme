import { type JSX, type ParentProps, createSignal } from "solid-js";
import { Button } from "../primitives/button.tsx";
import { TextField } from "../primitives/text-field.tsx";
import { actionLabel } from "./action-labels.ts";
import * as styles from "./room.css.ts";

export function JoinForm(props: { onSubmit: (name: string) => void }): JSX.Element {
  const [name, setName] = createSignal("");
  return (
    <form
      class={styles.row}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(name());
      }}
    >
      <TextField
        label="Your name"
        maxLength={24}
        autocomplete="nickname"
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <Button type="submit">{actionLabel.join}</Button>
    </form>
  );
}

/** Renders the chat box, with the room's main buttons right after `send`. */
export function ChatForm(
  props: ParentProps<{
    onSay: (text: string) => void;
    inputRef?: (input: HTMLInputElement) => void;
  }>,
): JSX.Element {
  const [text, setText] = createSignal("");
  return (
    <form
      class={styles.chatRow}
      onSubmit={(event) => {
        event.preventDefault();
        if (text().trim()) {
          props.onSay(text());
          setText("");
        }
      }}
    >
      <TextField
        label="Message"
        ref={(input: HTMLInputElement) => props.inputRef?.(input)}
        maxLength={300}
        autocomplete="off"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <Button type="submit" variant="ghost">
        send
      </Button>
      {props.children}
    </form>
  );
}
