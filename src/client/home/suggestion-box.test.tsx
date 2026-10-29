import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { SuggestionBox, type SuggestionGroup } from "./suggestion-box.tsx";

afterEach(cleanup);

const groups: SuggestionGroup[] = [
  {
    id: "history",
    label: "your goals",
    options: [
      { id: "h1", label: "Super Mario 64 - 16 Star", removable: true },
      { id: "h2", label: "Mario Kart 8 - 150cc", removable: true },
    ],
  },
  {
    id: "speedrun",
    label: "speedrun.com",
    options: [{ id: "o1y9wo6q", label: "Super Mario 64" }],
  },
];

function renderBox(initial: SuggestionGroup[] = groups) {
  const picked: string[] = [];
  const removed: string[] = [];
  const [shown, setShown] = createSignal(initial);
  const view = render(() => (
    <SuggestionBox
      label="goal or room code"
      groups={shown()}
      onInput={() => {}}
      onPick={(option) => picked.push(option.id)}
      onRemove={(option) => {
        removed.push(option.id);
        setShown(shown().map((g) => ({ ...g, options: g.options.filter((o) => o !== option) })));
      }}
    />
  ));
  const input = view.getByRole("combobox", { name: "goal or room code" }) as HTMLInputElement;
  const key = (name: string) => fireEvent.keyDown(input, { key: name });
  const active = () => {
    const id = input.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent : null;
  };
  return { ...view, input, key, active, picked, removed };
}

describe("SuggestionBox", () => {
  test("stays closed until the field is typed in or ArrowDown opens it", () => {
    const box = renderBox();
    expect(box.input.getAttribute("aria-expanded")).toBe("false");

    box.key("ArrowDown");

    expect(box.input.getAttribute("aria-expanded")).toBe("true");
    expect(box.getByRole("listbox")).toBeTruthy();
  });

  test("labels each group with its source", () => {
    const box = renderBox();
    box.key("ArrowDown");

    const names = box
      .getAllByRole("group")
      .map((g) => document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent);

    expect(names).toEqual(["your goals", "speedrun.com"]);
  });

  test("arrow keys move through the options and their group headers", () => {
    const box = renderBox();

    box.key("ArrowDown");
    box.key("ArrowDown");
    expect(box.active()).toContain("Super Mario 64 - 16 Star");

    box.key("ArrowDown");
    box.key("ArrowDown");
    expect(box.active()).toContain("speedrun.com");

    box.key("ArrowUp");
    expect(box.active()).toContain("Mario Kart 8");
  });

  test("Enter picks the active option and closes the list", () => {
    const box = renderBox();
    box.key("ArrowDown");
    box.key("ArrowDown");

    box.key("Enter");

    expect(box.picked).toEqual(["h1"]);
    expect(box.input.getAttribute("aria-expanded")).toBe("false");
  });

  test("a click picks an option", () => {
    const box = renderBox();
    box.key("ArrowDown");

    fireEvent.click(box.getByRole("option", { name: "Super Mario 64" }));

    expect(box.picked).toEqual(["o1y9wo6q"]);
  });

  test("Enter on a group header collapses the group and skips its options", () => {
    const box = renderBox();
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("ArrowUp");

    box.key("Enter");
    box.key("ArrowDown");

    expect(box.queryByRole("option", { name: "Mario Kart 8 - 150cc" })).toBeNull();
    expect(box.active()).toContain("speedrun.com");
    expect(box.picked).toEqual([]);
  });

  test("Delete removes the active history goal and says so", () => {
    const box = renderBox();
    box.key("ArrowDown");
    box.key("ArrowDown");

    box.key("Delete");

    expect(box.removed).toEqual(["h1"]);
    expect(box.getByText("removed Super Mario 64 - 16 Star.")).toBeTruthy();
  });

  test("the × next to a history goal removes it without picking it", () => {
    const box = renderBox();
    box.key("ArrowDown");

    fireEvent.click(box.getAllByTitle("remove from your goals")[0] as HTMLElement);

    expect(box.removed).toEqual(["h1"]);
    expect(box.picked).toEqual([]);
  });

  test("Delete does nothing on a speedrun.com game", () => {
    const box = renderBox();
    box.key("ArrowUp");
    expect(box.active()).toBe("Super Mario 64");

    box.key("Delete");

    expect(box.removed).toEqual([]);
  });

  test("Escape closes the list", () => {
    const box = renderBox();
    box.key("ArrowDown");

    box.key("Escape");

    expect(box.input.getAttribute("aria-expanded")).toBe("false");
  });

  test("Enter without an active option leaves the form to submit", () => {
    const box = renderBox();

    const notCancelled = fireEvent.keyDown(box.input, { key: "Enter" });

    expect(notCancelled).toBe(true);
  });

  test("never opens an empty list", () => {
    const box = renderBox([]);

    box.key("ArrowDown");

    expect(box.input.getAttribute("aria-expanded")).toBe("false");
  });

  test("a click on the field opens the list", () => {
    const box = renderBox();

    fireEvent.click(box.input);

    expect(box.input.getAttribute("aria-expanded")).toBe("true");
  });

  test("the row for the field's own text reads as using it as the goal", () => {
    const box = renderBox([
      {
        id: "history",
        label: "your goals",
        options: [{ id: "typed", label: "bingo", typed: true }],
      },
    ]);
    box.key("ArrowDown");

    expect(box.getByRole("option", { name: "use bingo as the goal" })).toBeTruthy();
  });

  test("names the list apart from the field, so the field's label stays unique", () => {
    const box = renderBox();
    box.key("ArrowDown");

    expect(box.getByRole("listbox").getAttribute("aria-label")).toBe("suggestions");
  });

  test("a group can start folded, even with nothing in it yet, and says when it unfolds", () => {
    const changes: [string, boolean][] = [];
    const view = render(() => (
      <SuggestionBox
        label="goal or room code"
        groups={[{ id: "speedrun", label: "speedrun.com", options: [], startsFolded: true }]}
        onInput={() => {}}
        onPick={() => {}}
        onRemove={() => {}}
        onFoldChange={(id, folded) => changes.push([id, folded])}
      />
    ));
    const input = view.getByRole("combobox", { name: "goal or room code" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(view.getByRole("option", { name: /speedrun\.com\s*, folded/ })).toBeTruthy();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(changes).toEqual([["speedrun", false]]);
  });
});
