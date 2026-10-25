import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { buttonVariant } from "./button.css.ts";

export type ButtonVariant = keyof typeof buttonVariant;

export interface ButtonProps extends Omit<ComponentProps<"button">, "type"> {
  /** Picks the look, `"accent"` by default. */
  variant?: ButtonVariant;
  /** Sets the native `type`, `"button"` by default so a button never submits a form by accident. */
  type?: "button" | "submit" | "reset";
}

/** Renders a native button in one of the raceme looks. */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, ["variant", "type", "class"]);
  const className = () =>
    [buttonVariant[local.variant ?? "accent"], local.class].filter(Boolean).join(" ");

  return <button type={local.type ?? "button"} class={className()} {...rest} />;
}
