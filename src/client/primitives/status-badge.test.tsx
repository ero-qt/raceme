import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { StatusBadge } from "./status-badge.tsx";

describe("StatusBadge", () => {
  // The label is always text because color alone may not show the status (WCAG 1.4.1).
  test("shows the status as text", () => {
    const { getByText } = render(() => <StatusBadge status="forfeit" />);
    expect(getByText("Forfeit")).toBeTruthy();
  });
});
