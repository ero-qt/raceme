import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { Button } from "./button.tsx";

describe("Button", () => {
  test("defaults to type button so it never submits a form", () => {
    const { getByRole } = render(() => <Button>ready</Button>);
    expect(getByRole("button", { name: "ready" }).getAttribute("type")).toBe("button");
  });

  test("a locked button is off and drains a ring over the lock, then is its plain self again", () => {
    const [lockedForMs, setLockedForMs] = createSignal<number | null>(3_000);
    const { getByRole } = render(() => (
      <Button lockedForMs={lockedForMs()} reason="wait 3 seconds.">
        .done
      </Button>
    ));
    const button = getByRole("button", { name: ".done" }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toBe("wait 3 seconds.");
    const ring = button.querySelector("svg") as SVGElement;
    expect(ring.style.animationDuration).toBe("3000ms");
    expect(ring.getAttribute("aria-hidden")).toBe("true");

    setLockedForMs(null);
    expect(button.disabled).toBe(false);
    expect(button.querySelector("svg")).toBeNull();
    expect(button.hasAttribute("title")).toBe(false);
  });

  test("a disabled button shows its reason as a tooltip, an enabled one doesn't", () => {
    const [disabled, setDisabled] = createSignal(true);
    const { getByRole } = render(() => (
      <Button disabled={disabled()} reason="you are muted.">
        send
      </Button>
    ));
    expect(getByRole("button", { name: "send" }).title).toBe("you are muted.");

    setDisabled(false);
    expect(getByRole("button", { name: "send" }).hasAttribute("title")).toBe(false);
  });
});
