import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";
import { Catalog } from "./catalog.tsx";
import { catalogEntries } from "./entries.tsx";

describe("Catalog", () => {
  test("shows a section heading for every entry", () => {
    const { getByRole } = render(() => <Catalog />);
    for (const entry of catalogEntries) {
      expect(getByRole("heading", { level: 2, name: entry.title })).toBeTruthy();
    }
  });
});
