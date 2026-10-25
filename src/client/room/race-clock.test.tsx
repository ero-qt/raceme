import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import type { FractionDigits } from "../../shared/format-time.ts";
import { RaceClock } from "./race-clock.tsx";

afterEach(cleanup);

function renderClock(digits: FractionDigits, elapsed = 65_439) {
  const picked: number[] = [];
  const view = render(() => (
    <RaceClock elapsed={elapsed} digits={digits} onPick={(d) => picked.push(d)} />
  ));
  const select = view.getByRole("combobox", { name: "Time precision" }) as HTMLSelectElement;
  return { ...view, picked, select };
}

describe("RaceClock", () => {
  test("names the full time for screen readers", () => {
    expect(renderClock(2).getByRole("timer").getAttribute("aria-label")).toBe("00:01:05.43");
  });

  test("shows whole seconds as text and the fraction in a native select", () => {
    const { getByRole, select } = renderClock(2);
    expect(getByRole("timer").textContent).toBe("00:01:05");
    expect(select.value).toBe("2");
  });

  test("offers all 4 styles with live digits, no decimals showing nothing", () => {
    const { select } = renderClock(0);
    expect(Array.from(select.options, (o) => o.textContent)).toEqual(["", ".4", ".43", ".439"]);
  });

  test("clicking the time opens the same native picker", () => {
    const { getByRole, select } = renderClock(0);
    let opened = 0;
    select.showPicker = () => {
      opened++;
    };
    fireEvent.click(getByRole("timer"));
    expect(opened).toBe(1);
  });

  test("reports a pick and lets go of focus", () => {
    const { select, picked } = renderClock(0);
    select.focus();
    fireEvent.change(select, { target: { value: "3" } });
    expect(picked).toEqual([3]);
    expect(document.activeElement).not.toBe(select);
  });

  test("keeps the whole seconds right during the countdown", () => {
    const { getByRole, select } = renderClock(3, -5_017);
    expect(getByRole("timer").textContent).toBe("-00:00:05");
    expect(select.selectedOptions[0]?.textContent).toBe(".017");
    expect(renderClock(0, -5_017).getAllByRole("timer").at(-1)?.textContent).toBe("-00:00:06");
  });
});
