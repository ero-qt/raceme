import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { IdleWarning, useActivityPings } from "./idle-warning.tsx";

afterEach(cleanup);

describe("IdleWarning", () => {
  test("shows the time left until an idle room closes", () => {
    const view = render(() => (
      <IdleWarning closesAt={14 * 60_000 + 32_000} now={0} quietFor="2 hours" />
    ));

    expect(view.getByRole("alert").textContent).toContain("Room closes soon!");
    expect(view.getByRole("alert").textContent).toContain("14:32");
    expect(view.getByRole("alert").textContent).toContain("No activity for 2 hours.");
    expect(view.getByRole("alert").textContent).toContain("Move the mouse, tap or type");
  });

  test("shows nothing while the room isn't idle", () => {
    const view = render(() => <IdleWarning closesAt={null} now={0} quietFor="" />);

    expect(view.queryByRole("alert")).toBeNull();
  });
});

describe("useActivityPings", () => {
  test("tells the server about input at most once a minute", () => {
    const sent: string[] = [];
    let now = 0;
    render(() => {
      useActivityPings({ send: () => sent.push("active"), warned: () => false, clock: () => now });
      return null;
    });

    fireEvent.pointerMove(window);
    now = 30_000;
    fireEvent.keyDown(window, { key: "a" });
    now = 60_000;
    fireEvent.pointerDown(window);

    expect(sent).toEqual(["active", "active"]);
  });

  test("answers right away while the room is warned as idle", () => {
    const sent: string[] = [];
    const [warned, setWarned] = createSignal(false);
    render(() => {
      useActivityPings({ send: () => sent.push("active"), warned, clock: () => 0 });
      return null;
    });
    fireEvent.pointerMove(window);

    setWarned(true);
    fireEvent.pointerMove(window);

    expect(sent).toEqual(["active", "active"]);
  });
});
