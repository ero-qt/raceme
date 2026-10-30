import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { Button } from "./button.tsx";

describe("Button", () => {
  test("defaults to type button so it never submits a form", () => {
    const { getByRole } = render(() => <Button>ready</Button>);
    expect(getByRole("button", { name: "ready" }).getAttribute("type")).toBe("button");
  });
});
