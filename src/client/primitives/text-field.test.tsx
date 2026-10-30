import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { visuallyHidden } from "../styles/controls.css.ts";
import { TextField } from "./text-field.tsx";

describe("textField", () => {
  // A placeholder alone vanishes once typing starts, so the label stays for screen readers.
  test("can hide its label and show a placeholder instead, keeping the name", () => {
    const { getByLabelText, getByText } = render(() => (
      <TextField label="your name" hideLabel placeholder="your name" />
    ));

    expect((getByLabelText("your name") as HTMLInputElement).placeholder).toBe("your name");
    expect(getByText("your name").classList.contains(visuallyHidden)).toBe(true);
  });
});
