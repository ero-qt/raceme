import { ClipboardCheck, Link, TriangleAlert } from "lucide-solid";
import { type JSX, Show, createSignal, onCleanup } from "solid-js";
import { icon, visuallyHidden, warningIcon } from "../styles/controls.css.ts";
import * as styles from "./invite-link.css.ts";

// Stands in for the link so the real one never sits in the page until someone asks for it. The
// scheme is all x too, so the built page contains no outside host.
const decoy = "xxxxx://xxxxxxxxx/xxxx/xxxxxx/x/xxxxxxxxxx";
const copiedForMs = 2_000;
const revealWarning = "you are about to reveal the invite link!";

type Visibility = "hidden" | "warned" | "shown";
type CopyResult = "copied" | "couldn't copy";

/**
 * Keeps the invite link hidden until the field is clicked twice, the first click warning about it.
 * Leaving the field hides it again. The link icon at the start of the field copies the link.
 */
export function InviteLink(props: { url: string }): JSX.Element {
  const [visibility, setVisibility] = createSignal<Visibility>("hidden");
  const [copyResult, setCopyResult] = createSignal<CopyResult | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));

  const advance = () => {
    const next: Record<Visibility, Visibility> = {
      hidden: "warned",
      warned: "shown",
      shown: "shown",
    };
    setVisibility(next[visibility()]);
  };
  const hide = () => setVisibility("hidden");

  const copy = async () => {
    // A browser can refuse the clipboard, for example when the page doesn't have focus.
    const result = await copyText(props.url).then(
      (): CopyResult => "copied",
      (): CopyResult => "couldn't copy",
    );

    setCopyResult(result);
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => setCopyResult(null), copiedForMs);
  };

  return (
    <div class={styles.frame} data-visibility={visibility()}>
      <button
        type="button"
        class={styles.copy}
        aria-label="copy invite link"
        title="copy invite link"
        onClick={copy}
      >
        {copyResult() === "copied" ? (
          <ClipboardCheck class={icon} aria-hidden="true" />
        ) : (
          <Link class={icon} aria-hidden="true" />
        )}
      </button>
      <p class={styles.toast} role="status">
        {copyResult()}
      </p>
      <p class={visuallyHidden} role="status">
        <Show when={visibility() === "warned"}>{revealWarning}</Show>
      </p>
      <div class={styles.revealArea}>
        <button
          type="button"
          class={styles.reveal}
          // Once the warning or the link shows, the visible text becomes the button's label.
          aria-label={visibility() === "hidden" ? "show invite link" : undefined}
          onClick={advance}
          onMouseLeave={hide}
          onBlur={hide}
        >
          <Show when={visibility() !== "hidden"}>
            <Show
              when={visibility() === "warned"}
              fallback={<span class={styles.text}>{props.url}</span>}
            >
              <TriangleAlert class={warningIcon} aria-hidden="true" />
              <span class={styles.text}>{revealWarning}</span>
            </Show>
          </Show>
        </button>
        {/* Sits beside the button instead of inside it, so its text isn't read as the button's label. */}
        <Show when={visibility() === "hidden"}>
          <span class={styles.decoy} aria-hidden="true">
            {decoy}
          </span>
        </Show>
      </div>
    </div>
  );
}

/**
 * Copies text with the Clipboard API. An http preview uses a throwaway text area instead because
 * the API only exists on https pages.
 */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
