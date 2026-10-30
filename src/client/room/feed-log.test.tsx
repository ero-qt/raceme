import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { FeedLog } from "./feed-log.tsx";

afterEach(cleanup);

describe("FeedLog", () => {
  test("Ctrl+A in the log selects the log's lines, not the page", () => {
    const view = render(() => (
      <>
        <p>outside</p>
        <FeedLog entries={[{ id: 1, at: 0, kind: "bot", text: "GO!" }]} />
      </>
    ));
    const log = view.getByRole("log", { name: "race chat" });
    log.focus();

    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    fireEvent(log, event);

    expect(event.defaultPrevented).toBe(true);
    const selection = document.getSelection();
    expect(selection?.anchorNode ? log.contains(selection.anchorNode) : true).toBe(true);
  });
});
