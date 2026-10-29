import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { ClosingWarning, useActivityPings } from "./closing-warning.tsx";

afterEach(cleanup);

describe("ClosingWarning", () => {
  test("shows the time left until an idle room closes", () => {
    const view = render(() => <ClosingWarning closesAt={14 * 60_000 + 32_000} now={0} />);

    expect(view.getByRole("alert").textContent).toContain("room closes soon due to inactivity!");
    expect(view.getByRole("alert").textContent).toContain("14:32");
    expect(view.getByRole("alert").textContent).not.toContain("No activity");
    expect(view.getByRole("alert").textContent).toContain("move the mouse, tap or type");
  });

  test("warns of a server restart until a click outside the card, not on movement", () => {
    const view = render(() => <ClosingWarning closesAt={45 * 60_000} now={0} reason="restart" />);
    const alert = view.getByRole("alert");
    expect(alert.textContent).toContain("room closes soon for a server restart!");
    expect(alert.textContent).toContain("45:00");

    fireEvent.pointerMove(window);
    fireEvent.pointerDown(alert);
    expect(view.queryByRole("alert")).not.toBeNull();

    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("alert")).toBeNull();
  });

  test("shows nothing while the room isn't idle", () => {
    const view = render(() => <ClosingWarning closesAt={null} now={0} />);

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
