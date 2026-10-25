import { type JSX, type ParentProps, Show, createSignal, onCleanup } from "solid-js";
import { maxChatLength } from "../../shared/protocol.ts";
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
        hideLabel
        placeholder="your name"
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
    /** Keeps `send` off this long after each line, matching the server's slow mode. */
    waitMs?: number;
    /** Turns the chat box and `send` off for an entrant the host muted. */
    muted?: boolean;
  }>,
): JSX.Element {
  const [text, setText] = createSignal("");
  const [waiting, setWaiting] = createSignal(false);
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(waitTimer));

  const startWait = () => {
    const waitMs = props.waitMs ?? 0;
    if (waitMs > 0) {
      setWaiting(true);
      waitTimer = setTimeout(() => setWaiting(false), waitMs);
    }
  };

  return (
    <form
      class={styles.chatRow}
      onSubmit={(event) => {
        event.preventDefault();
        if (text().trim() && !waiting() && !props.muted) {
          props.onSay(text());
          setText("");
          startWait();
        }
      }}
    >
      <TextField
        label="Message"
        hideLabel
        placeholder={props.muted ? "you are muted" : "chat"}
        disabled={props.muted}
        ref={(input: HTMLInputElement) => props.inputRef?.(input)}
        maxLength={maxChatLength}
        autocomplete="off"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        class={styles.sendButton}
        disabled={waiting() || props.muted}
        aria-label="send"
      >
        <span class={styles.sendLabel} data-waiting={waiting()}>
          send
        </span>
        <Show when={waiting()}>
          <svg
            class={styles.waitRing}
            style={{ "animation-duration": `${props.waitMs}ms` }}
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" pathLength="1" />
          </svg>
        </Show>
      </Button>
      {props.children}
    </form>
  );
}
