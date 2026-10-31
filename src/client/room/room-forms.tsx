import { CornerDownLeft } from "lucide-solid";
import { type JSX, type ParentProps, createSignal, onCleanup } from "solid-js";
import { maxChatLength } from "../../shared/protocol.ts";
import { maxNameLength } from "../../shared/race/race.ts";
import { Button } from "../primitives/button.tsx";
import { TextField } from "../primitives/text-field.tsx";
import { icon, notice } from "../styles/controls.css.ts";
import { actionLabel, refusalText } from "./action-labels.ts";
import * as styles from "./room.css.ts";

export function JoinForm(props: {
  onSubmit: (name: string) => void;
  /** Turns the form off and shows why in a line above it, like `entry is closed`. */
  closedBecause?: string | null;
  /** Runs the first time the typed name reaches the longest a name can be. */
  onLimit?: () => void;
  /** Fills the field, like with the name of someone who just left the race. */
  initialName?: string;
}): JSX.Element {
  const [name, setName] = createSignal(props.initialName ?? "");
  let limitShown = false;
  return (
    <form
      class={styles.joinForm}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(name());
      }}
    >
      <p class={`${notice} ${styles.formNotice}`} role="status">
        {props.closedBecause ? `${props.closedBecause}.` : ""}
      </p>
      <TextField
        label="your name"
        hideLabel
        placeholder="your name"
        value={props.initialName ?? ""}
        disabled={Boolean(props.closedBecause)}
        maxLength={maxNameLength}
        autocomplete="nickname"
        onInput={(e) => {
          if (e.currentTarget.value.length >= maxNameLength && !limitShown) {
            limitShown = true;
            props.onLimit?.();
          }
          setName(e.currentTarget.value);
        }}
      />
      <Button type="submit" disabled={Boolean(props.closedBecause)}>
        {actionLabel.join}
      </Button>
    </form>
  );
}

/** Renders the chat box, with the room's main buttons right after `send`. */
export function ChatForm(
  props: ParentProps<{
    onSay: (text: string) => void;
    /** Runs a command line like `.done` right away, even during the slow mode wait. */
    onCommand?: (text: string) => boolean;
    inputRef?: (input: HTMLInputElement) => void;
    /** Keeps `send` off this long after each line, matching the server's slow mode. */
    waitMs?: number;
    /** Turns the chat box and `send` off for an entrant the host muted. */
    muted?: boolean;
  }>,
): JSX.Element {
  const [text, setText] = createSignal("");
  const [waiting, setWaiting] = createSignal(false);
  let messageBox: HTMLInputElement | undefined;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(waitTimer));

  const startWait = () => {
    const waitMs = props.waitMs ?? 0;
    if (waitMs > 0) {
      setWaiting(true);
      waitTimer = setTimeout(() => setWaiting(false), waitMs);
    }
  };

  const sendLine = () => {
    if (!text().trim() || props.muted) {
      return;
    }
    if (props.onCommand?.(text())) {
      setText("");
    } else if (!waiting()) {
      props.onSay(text());
      setText("");
      startWait();
    }
  };

  return (
    <form
      class={styles.chatRow}
      onSubmit={(event) => {
        event.preventDefault();
        sendLine();
        // `send` turns itself off for the slow mode wait, which would drop the focus to the page.
        messageBox?.focus();
      }}
    >
      <p class={`${notice} ${styles.formNotice}`} role="status">
        {props.muted ? "you are muted." : ""}
      </p>
      <div class={styles.chatLine}>
        <TextField
          label="message"
          hideLabel
          placeholder="chat"
          disabled={props.muted}
          ref={(input: HTMLInputElement) => {
            messageBox = input;
            props.inputRef?.(input);
          }}
          maxLength={maxChatLength}
          autocomplete="off"
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          // Browsers skip Enter's submit while `send` is off, so a command still goes out in the wait.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendLine();
            }
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          class={styles.sendButton}
          disabled={props.muted}
          lockedForMs={waiting() ? props.waitMs : null}
          reason={props.muted ? refusalText.muted : refusalText.slowMode}
          aria-label="send"
        >
          <CornerDownLeft class={icon} aria-hidden="true" />
        </Button>
        {props.children}
      </div>
    </form>
  );
}
