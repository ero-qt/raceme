import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import type { ClientAction } from "../../shared/protocol.ts";
import { type RaceAction, type RaceState, apply, createRace } from "../../shared/race/race.ts";
import { RoomView } from "./room-view.tsx";

function raceAfter(actions: RaceAction[]): RaceState {
  let state = createRace({ countdownMs: 10_000, fractionDigits: 0 });
  for (const action of actions) {
    const result = apply(state, action, 0);
    if (!result.ok) {
      throw new Error(result.refusal);
    }
    state = result.state;
  }
  return state;
}

const joinedBoth: RaceAction[] = [
  { type: "setGoal", goal: "any%" },
  { type: "join", entrantId: "a", name: "alice" },
  { type: "join", entrantId: "b", name: "bob" },
];
const race = raceAfter(joinedBoth);

const inviteUrl = "https://example.test/r/abcdefghij";

afterEach(cleanup);

function renderRoom(entrantId: string, isHost = false, state: RaceState = race) {
  const sent: ClientAction[] = [];
  const view = render(() => (
    <RoomView
      race={state}
      me={{ entrantId, isHost }}
      now={0}
      inviteUrl={inviteUrl}
      notice={null}
      feed={[
        { id: 1, at: 0, kind: "bot", text: "alice enters the race! 1 entrant." },
        { id: 2, at: 0, kind: "chat", name: "alice", text: "gl hf" },
      ]}
      send={(action) => sent.push(action)}
    />
  ));
  return { ...view, sent };
}

function rowOf(view: ReturnType<typeof renderRoom>, name: string): HTMLElement {
  const cell = view.getAllByRole("cell").find((c) => c.textContent === name);
  const row = cell?.closest("tr");
  if (!row) {
    throw new Error(`no row for ${name}`);
  }
  return row;
}

describe("RoomView goal", () => {
  test("shows the goal as the page title", () => {
    expect(renderRoom("x").getByRole("heading", { level: 1 }).textContent).toBe("any%");
  });

  test("the host edits the title itself, which selects all on focus", () => {
    const host = renderRoom("a", true);
    const input = host.getByLabelText("Goal") as HTMLInputElement;
    expect(host.getByRole("heading", { level: 1 }).contains(input)).toBe(true);
    expect(input.value).toBe("any%");

    fireEvent.focus(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);

    fireEvent.input(input, { target: { value: "100%" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(host.sent).toEqual([{ type: "setGoal", goal: "100%" }]);
  });

  test("Tab from the goal reaches .setgoal instead of hiding it", () => {
    const host = renderRoom("a", true);
    const input = host.getByLabelText("Goal");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "120 star" } });
    const setGoal = host.getByRole("button", { name: ".setgoal" });

    fireEvent.blur(input, { relatedTarget: setGoal });
    fireEvent.focusOut(input, { relatedTarget: setGoal });

    expect(host.queryByRole("button", { name: ".setgoal" })).toBe(setGoal);
  });

  test("the goal can't be edited once the race runs, since the server would refuse it", () => {
    const running = { ...race, phase: "running" as const, startsAt: 0 };

    expect(renderRoom("a", true, running).queryByLabelText("Goal")).toBeNull();
  });

  test(".setgoal shows only while the host edits the goal", () => {
    const host = renderRoom("a", true);
    expect(host.queryByRole("button", { name: ".setgoal" })).toBeNull();

    const input = host.getByLabelText("Goal");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "120 star" } });
    fireEvent.click(host.getByRole("button", { name: ".setgoal" }));
    expect(host.sent).toEqual([{ type: "setGoal", goal: "120 star" }]);
  });

  test("Escape puts the goal back", () => {
    const host = renderRoom("a", true);
    const input = host.getByLabelText("Goal") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "oops" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("any%");
    expect(host.sent).toEqual([]);
  });

  test("guests get plain text", () => {
    expect(renderRoom("a").queryByLabelText("Goal")).toBeNull();
  });
});

describe("RoomView layout", () => {
  test(".end sits on the clock's line, host only", () => {
    const host = renderRoom("a", true);
    const end = host.getByRole("button", { name: ".end" });

    expect(end.parentElement?.contains(host.getByRole("timer"))).toBe(true);
    expect(renderRoom("a").queryByRole("button", { name: ".end" })).toBeNull();
  });

  test("the room status sits with the entrants heading", () => {
    const heading = renderRoom("x").getByRole("heading", { name: /Entrants/ });

    expect(heading.parentElement?.textContent).toContain("Entry Open");
  });

  test("an empty room says nobody has entered instead of showing an empty table", () => {
    const empty = raceAfter([{ type: "setGoal", goal: "any%" }]);
    const view = renderRoom("x", false, empty);

    expect(view.queryByRole("table", { name: "Entrants" })).toBeNull();
    expect(view.getByText("Nobody has entered yet.")).toBeTruthy();
  });

  test("lists entrants with their status", () => {
    const table = renderRoom("x").getByRole("table", { name: "Entrants" });

    expect(table.textContent).toContain("alice");
    expect(table.textContent).toContain("Not ready");
  });

  test(".unenter sits in your own row", () => {
    const view = renderRoom("a");

    expect(rowOf(view, "alice").contains(view.getByRole("button", { name: ".unenter" }))).toBe(
      true,
    );
  });

  test(".quit sits in your own row during the race", () => {
    const running = { ...race, phase: "running" as const, startsAt: 0 };
    const view = renderRoom("a", false, running);

    expect(rowOf(view, "alice").contains(view.getByRole("button", { name: ".quit" }))).toBe(true);
  });

  test("the host can .remove others but not themselves", () => {
    const host = renderRoom("a", true);
    expect(host.queryByRole("button", { name: ".remove alice" })).toBeNull();

    fireEvent.click(host.getByRole("button", { name: ".remove bob" }));
    expect(host.sent).toEqual([{ type: "remove", entrantId: "b" }]);
  });

  test("entrants come after the chat box", () => {
    const view = renderRoom("a");
    const message = view.getByLabelText("Message");
    const table = view.getByRole("table", { name: "Entrants" });

    expect(message.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test(".ready sits right next to send", () => {
    const view = renderRoom("a");
    const send = view.getByRole("button", { name: "send" });

    expect(send.nextElementSibling).toBe(view.getByRole("button", { name: ".ready" }));
  });

  test("focus stays on the race button when .ready turns into .unready", () => {
    const [state, setState] = createSignal(race);
    const view = render(() => (
      <RoomView
        race={state()}
        me={{ entrantId: "a", isHost: false }}
        now={0}
        inviteUrl={inviteUrl}
        notice={null}
        feed={[]}
        send={() => {}}
      />
    ));
    const ready = view.getByRole("button", { name: ".ready" });
    ready.focus();

    fireEvent.click(ready);
    setState(raceAfter([...joinedBoth, { type: "ready", entrantId: "a" }]));

    expect(document.activeElement).toBe(view.getByRole("button", { name: ".unready" }));
  });

  test("focus moves into the chat when the pressed button goes away", () => {
    const [state, setState] = createSignal(race);
    const view = render(() => (
      <RoomView
        race={state()}
        me={{ entrantId: "a", isHost: false }}
        now={0}
        inviteUrl={inviteUrl}
        notice={null}
        feed={[]}
        send={() => {}}
      />
    ));
    const unenter = view.getByRole("button", { name: ".unenter" });
    unenter.focus();

    fireEvent.click(unenter);
    setState(raceAfter([...joinedBoth, { type: "leave", entrantId: "a" }]));

    expect(document.activeElement).toBe(view.getByLabelText("Your name"));
  });

  test("entering moves focus to the message box", () => {
    const [state, setState] = createSignal(race);
    const view = render(() => (
      <RoomView
        race={state()}
        me={{ entrantId: "c", isHost: false }}
        now={0}
        inviteUrl={inviteUrl}
        notice={null}
        feed={[]}
        send={() => {}}
      />
    ));
    setState(
      raceAfter([
        { type: "setGoal", goal: "any%" },
        { type: "join", entrantId: "c", name: "carol" },
      ]),
    );

    expect(document.activeElement).toBe(view.getByLabelText("Message"));
  });
});

describe("RoomView precision", () => {
  test("the host's pick sets the room default", () => {
    const host = renderRoom("a", true);
    fireEvent.change(host.getByRole("combobox", { name: "Time precision" }), {
      target: { value: "2" },
    });

    expect(host.sent).toEqual([{ type: "setFractionDigits", digits: 2 }]);
  });

  test("the host's pick drops their own older guest pick so they see the room default", () => {
    localStorage.setItem("raceme.fractionDigits", "3");
    const host = renderRoom("a", true);
    fireEvent.change(host.getByRole("combobox", { name: "Time precision" }), {
      target: { value: "1" },
    });

    expect(localStorage.getItem("raceme.fractionDigits")).toBeNull();
    expect(host.getByRole("timer").getAttribute("aria-label")).toBe("00:00:00");

    localStorage.clear();
  });

  test("a guest's pick only changes their own view", () => {
    localStorage.clear();
    const guest = renderRoom("b");
    fireEvent.change(guest.getByRole("combobox", { name: "Time precision" }), {
      target: { value: "3" },
    });

    expect(guest.sent).toEqual([]);
    expect(guest.getByRole("timer").getAttribute("aria-label")).toBe("00:00:00.000");

    localStorage.clear();
  });
});

describe("RoomView actions", () => {
  test("a visitor joins with a name", () => {
    const { getByLabelText, getByRole, sent } = renderRoom("x");
    fireEvent.input(getByLabelText("Your name"), { target: { value: "carol" } });
    fireEvent.submit(getByRole("button", { name: ".enter" }).closest("form") as HTMLFormElement);

    expect(sent).toEqual([{ type: "join", name: "carol" }]);
  });

  test(".unready is neutral like send, not green", () => {
    const state = raceAfter([
      { type: "setGoal", goal: "any%" },
      { type: "join", entrantId: "a", name: "alice" },
      { type: "ready", entrantId: "a" },
    ]);
    const view = renderRoom("a", false, state);

    expect(view.getByRole("button", { name: ".unready" }).className).toBe(
      view.getByRole("button", { name: "send" }).className,
    );
  });

  test("an entrant gets a .ready button that sends ready", () => {
    const { getByRole, sent } = renderRoom("a");
    fireEvent.click(getByRole("button", { name: ".ready" }));

    expect(sent).toEqual([{ type: "ready" }]);
  });

  // SRL had no separate un-forfeit: .undone took back a .quit as well.
  test("a forfeited racer takes it back with .undone", () => {
    const state: RaceState = {
      ...race,
      phase: "running",
      startsAt: 0,
      entrants: [{ id: "a", name: "alice", ready: true, result: { kind: "forfeit" } }],
    };

    expect(renderRoom("a", false, state).getByRole("button", { name: ".undone" })).toBeTruthy();
  });

  test("entrants stay ready, not racing, during the countdown", () => {
    const state: RaceState = {
      ...race,
      phase: "countdown",
      startsAt: 10_000,
      entrants: [{ id: "a", name: "alice", ready: true, result: null }],
    };
    const table = renderRoom("x", false, state).getByRole("table", { name: "Entrants" });

    expect(table.textContent).toContain("Ready");
    expect(table.textContent).not.toContain("Racing");
  });

  test("results can be downloaded once the race is over, not before", () => {
    expect(renderRoom("x").queryByRole("link", { name: "download .csv" })).toBeNull();

    const state: RaceState = { ...race, phase: "finished", startsAt: 0, endedAt: 1 };
    expect(renderRoom("x", false, state).getByRole("link", { name: "download .csv" })).toBeTruthy();
  });

  // SRL called a finished race "Complete".
  test("a finished race shows Complete", () => {
    const state: RaceState = { ...race, phase: "finished", startsAt: 0, endedAt: 1 };

    expect(renderRoom("x", false, state).getByText("Complete")).toBeTruthy();
  });

  test("shows RaceBot lines and chat IRC style", () => {
    const log = renderRoom("x").getByRole("log", { name: "Race chat" });

    expect(log.textContent).toContain("<RaceBot>");
    expect(log.textContent).toContain("alice enters the race! 1 entrant.");
    expect(log.textContent).toContain("<alice>");
  });

  test("an entrant can chat", () => {
    const { getByLabelText, sent } = renderRoom("a");
    const input = getByLabelText("Message");
    fireEvent.input(input, { target: { value: "gl hf" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(sent).toEqual([{ type: "say", text: "gl hf" }]);
  });
});

describe("RoomView invite link", () => {
  test("is never in the page until the field itself is clicked twice", () => {
    const view = renderRoom("x");
    const field = view.getByRole("button", { name: "Show invite link" });
    expect(document.body.innerHTML).not.toContain("abcdefghij");

    fireEvent.click(field);
    expect(field.textContent).toContain("You are about to reveal the invite link!");
    expect(field.querySelector(".lucide-triangle-alert")).not.toBeNull();
    expect(document.body.innerHTML).not.toContain("abcdefghij");

    fireEvent.click(field);
    expect(view.getByText(inviteUrl)).toBeTruthy();
  });

  test("leaving the field hides it again", () => {
    const view = renderRoom("x");
    const field = view.getByRole("button", { name: "Show invite link" });
    fireEvent.click(field);
    fireEvent.click(field);
    fireEvent.mouseLeave(field);
    expect(document.body.innerHTML).not.toContain("abcdefghij");

    fireEvent.click(field);
    fireEvent.blur(field);
    expect(field.textContent).not.toContain("about to reveal");
  });

  test("the link icon is the copy button, no separate one", () => {
    const view = renderRoom("x");
    const copy = view.getByRole("button", { name: "Copy invite link" });

    expect(copy.querySelector(".lucide-link")).not.toBeNull();
    expect(view.getAllByRole("button", { name: /copy/i })).toHaveLength(1);
  });

  test("copy turns the icon into a check and says copied", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void copied.push(text) },
    });
    const view = renderRoom("x");
    fireEvent.click(view.getByRole("button", { name: "Copy invite link" }));
    await waitFor(() => expect(view.getByText("copied")).toBeTruthy());
    expect(copied).toEqual([inviteUrl]);

    const copy = view.getByRole("button", { name: "Copy invite link" });
    expect(copy.querySelector(".lucide-clipboard-check")).not.toBeNull();
  });

  test("a refused copy says so instead of staying silent", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
    });
    const view = renderRoom("x");

    fireEvent.click(view.getByRole("button", { name: "Copy invite link" }));

    await waitFor(() => expect(view.getByText("couldn't copy")).toBeTruthy());
    expect(view.queryByText("copied")).toBeNull();
  });

  test("the warning names the reveal button, as speech users will say what they see", () => {
    const view = renderRoom("x");

    fireEvent.click(view.getByRole("button", { name: "Show invite link" }));

    expect(view.getByRole("button", { name: /about to reveal the invite link/ })).toBeTruthy();
  });
});
