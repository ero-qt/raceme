import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { TextField } from "./text-field.tsx";

describe("TextField", () => {
  // Checkers like HTML_CodeSniffer only accept autocomplete tokens on inputs typed as text.
  test("renders a labeled input typed as text", () => {
    const { getByLabelText } = render(() => (
      <TextField label="Your name" autocomplete="nickname" />
    ));
    expect((getByLabelText("Your name") as HTMLInputElement).getAttribute("type")).toBe("text");
  });
});
