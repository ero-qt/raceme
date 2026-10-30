import { For, type JSX } from "solid-js";
import { type FractionDigits, formatClock, formatFraction } from "../../shared/format-time.ts";
import * as styles from "./race-clock.css.ts";

const choices: FractionDigits[] = [0, 1, 2, 3];

/**
 * Shows the race clock with the fraction digits in a native select, so phones open their own
 * picker wheel. A click anywhere on the clock opens it. Each option previews its style with the
 * live digits.
 */
export function RaceClock(props: {
  elapsed: number;
  digits: FractionDigits;
  onPick: (digits: FractionDigits) => void;
}): JSX.Element {
  const full = () => formatClock(props.elapsed, props.digits);

  let select: HTMLSelectElement | undefined;
  // Browsers without `showPicker` on selects still get the select focused for the keyboard.
  const openPicker = (event: MouseEvent) => {
    if (event.target === select) {
      return;
    }

    if (select?.showPicker) {
      select.showPicker();
    } else {
      select?.focus();
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users reach the select inside directly
    <label
      class={styles.clock}
      classList={{ [styles.countdown]: props.elapsed < 0 }}
      data-countdown={props.elapsed < 0}
      onClick={openPicker}
    >
      <span role="timer" aria-label={full()}>
        {full().replace("-", "").split(".")[0]}
      </span>
      <select
        ref={select}
        class={styles.fraction}
        aria-label="time precision"
        value={String(props.digits)}
        onChange={(event) => {
          props.onPick(Number(event.currentTarget.value) as FractionDigits);
          event.currentTarget.blur();
        }}
      >
        <For each={choices}>
          {(digits) => (
            <option
              value={String(digits)}
              {...(digits === 0 ? { "aria-label": "whole seconds" } : {})}
            >
              {formatFraction(props.elapsed, digits)}
            </option>
          )}
        </For>
      </select>
    </label>
  );
}
