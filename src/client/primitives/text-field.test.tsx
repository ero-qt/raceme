import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { TextField } from "./text-field.tsx";

describe("textField", () => {
  // Checkers like HTML_CodeSniffer only accept autocomplete tokens on inputs typed as text.
  test("renders a labeled input typed as text", () => {
    const { getByLabelText } = render(() => (
      <TextField label="your name" autocomplete="nickname" />
    ));
    expect((getByLabelText("your name") as HTMLInputElement).getAttribute("type")).toBe("text");
  });

  // A placeholder alone vanishes once typing starts, so the label stays for screen readers.
  test("can hide its label and show a placeholder instead, keeping the name", () => {
    const { getByLabelText, getByText } = render(() => (
      <TextField label="your name" hideLabel placeholder="your name" />
    ));

    expect((getByLabelText("your name") as HTMLInputElement).placeholder).toBe("your name");
    expect(getByText("your name").dataset.hidden).toBe("true");
  });
});
