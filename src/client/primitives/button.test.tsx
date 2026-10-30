import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";
import { Button } from "./button.tsx";

describe("Button", () => {
  test("defaults to type button so it never submits a form", () => {
    const { getByRole } = render(() => <Button>ready</Button>);
    expect(getByRole("button", { name: "ready" }).getAttribute("type")).toBe("button");
  });

  test("calls onClick", () => {
    let clicks = 0;
    const { getByRole } = render(() => <Button onClick={() => clicks++}>done</Button>);
    fireEvent.click(getByRole("button", { name: "done" }));
    expect(clicks).toBe(1);
  });
});
