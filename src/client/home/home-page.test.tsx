import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { HomePage } from "./home-page.tsx";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  cleanup();
});

function renderHome(
  existing: string[] = ["duxanagxds"],
  options: { checkDelayMs?: number; checkFails?: boolean } = {},
) {
  const opened: string[] = [];
  const view = render(() => (
    <HomePage
      open={(slug) => opened.push(slug)}
      roomExists={async (slug) => {
        if (options.checkFails) {
          throw new Error("offline");
        }
        return existing.includes(slug);
      }}
      checkDelayMs={options.checkDelayMs ?? 0}
    />
  ));
  const field = view.getByLabelText("Goal or room code") as HTMLInputElement;
  const type = (value: string) => fireEvent.input(field, { target: { value } });
  const submit = () => fireEvent.submit(field.closest("form") as HTMLFormElement);
  return { ...view, opened, field, type, submit };
}

describe("HomePage", () => {
  test("can open with a notice, like a room that closed", () => {
    const view = render(() => <HomePage notice="This room has closed." />);

    expect(view.getByRole("status").textContent).toBe("This room has closed.");
    expect(view.getByLabelText("Goal or room code")).toBeTruthy();
  });

  test("one field at the top, .startrace greyed out while empty", () => {
    const home = renderHome();

    expect(home.field.placeholder).toBe("set a goal or paste a room code");
    expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  test("a goal opens a lobby with it", async () => {
    const fetchMock = mock(async () => Response.json({ slug: "duxanagxds" }, { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const home = renderHome();
    home.type("any%");
    home.submit();
    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(JSON.parse(String(init.body))).toEqual({ goal: "any%" });
  });

  test("a pasted code of a live room is recognized, masked and joins", async () => {
    const home = renderHome();
    home.type("DUXANAGXDS");
    await waitFor(() => expect(home.getByRole("button", { name: "join" })).toBeTruthy());
    expect(home.queryByRole("button", { name: ".startrace" })).toBeNull();
    expect(home.field.dataset.kind).toBe("code");

    home.submit();
    expect(home.opened).toEqual(["duxanagxds"]);
  });

  test("a pasted invite link joins too", async () => {
    const home = renderHome();
    home.type("https://ero-qt.eu/apps/raceme/r/duxanagxds");
    await waitFor(() => expect(home.getByRole("button", { name: "join" })).toBeTruthy());
    home.submit();

    expect(home.opened).toEqual(["duxanagxds"]);
  });

  // "glitchless" has the shape of a room code, but no such room exists, so it stays a goal.
  test("a code-shaped goal stays a goal when no such room exists", async () => {
    const home = renderHome([]);
    home.type("glitchless");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(home.getByRole("button", { name: ".startrace" })).toBeTruthy();
    expect(home.field.dataset.kind).toBe("goal");
  });

  test("Enter right after pasting a code waits for the check, not opening a lobby", async () => {
    globalThis.fetch = mock(async () => Response.json({ slug: "x" }, { status: 201 })) as never;
    const home = renderHome(["duxanagxds"], { checkDelayMs: 10_000 });
    home.type("https://ero-qt.eu/apps/raceme/r/duxanagxds");
    home.submit();
    await waitFor(() => expect(home.opened).toEqual(["duxanagxds"]));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("a failed check says so instead of opening a lobby named after the code", async () => {
    const fetchMock = mock(async () => Response.json({ slug: "x" }, { status: 201 }));
    globalThis.fetch = fetchMock as never;
    const home = renderHome([], { checkFails: true });
    home.type("duxanagxds");
    home.submit();
    await waitFor(() =>
      expect(home.getByRole("status").textContent).toBe(
        "Couldn't check that room code. Try again.",
      ),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(home.opened).toEqual([]);
  });

  test("a refused goal says why", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 400 })) as unknown as typeof fetch;
    const home = renderHome();
    home.type("x");
    home.submit();
    await waitFor(() =>
      expect(home.getByRole("status").textContent).toBe("The goal needs 1 to 200 characters."),
    );
  });

  test("an unreachable server frees .startrace again and says so", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const home = renderHome();
    home.type("any%");

    home.submit();

    await waitFor(() => expect(home.getByRole("status").textContent).toBe("Couldn't open a room."));
    expect((home.getByRole("button", { name: ".startrace" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
