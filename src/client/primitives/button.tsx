import { type ComponentProps, type JSX, Show, splitProps, untrack } from "solid-js";
import { buttonVariant, label, lockRing } from "./button.css.ts";

export type ButtonVariant = keyof typeof buttonVariant;

export interface ButtonProps extends Omit<ComponentProps<"button">, "type"> {
  /** Picks the look, `"accent"` by default. */
  variant?: ButtonVariant;
  /** Sets the native `type`, `"button"` by default so a button never submits a form by accident. */
  type?: "button" | "submit" | "reset";
  /**
   * Locks the button for this long: it turns off and a ring drains over the time in place of
   * its label, like a cooldown. `null` or `undefined` leaves it unlocked.
   */
  lockedForMs?: number | null | undefined;
  /** The reason the button is off, shown as a tooltip while it is disabled or locked. */
  reason?: string | undefined;
}

/** Renders a native button in one of the raceme looks. */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "variant",
    "type",
    "class",
    "lockedForMs",
    "disabled",
    "children",
    "reason",
  ]);
  const className = () =>
    [buttonVariant[local.variant ?? "accent"], local.class].filter(Boolean).join(" ");
  const locked = () => local.lockedForMs !== null && local.lockedForMs !== undefined;

  return (
    <button
      type={local.type ?? "button"}
      class={className()}
      data-variant={local.variant ?? "accent"}
      disabled={local.disabled || locked()}
      title={local.disabled || locked() ? local.reason : undefined}
      {...rest}
    >
      <span class={label} data-locked={locked()}>
        {local.children}
      </span>
      <Show when={locked()}>
        {/* The ring reads its time once, since a lock that counts down would restart it. */}
        <svg
          class={lockRing}
          style={{ "animation-duration": `${untrack(() => local.lockedForMs)}ms` }}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8" pathLength="1" />
        </svg>
      </Show>
    </button>
  );
}
