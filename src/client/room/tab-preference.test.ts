import { afterEach, describe, expect, test } from "bun:test";
import { loadTab, saveTab } from "./tab-preference.ts";

afterEach(() => sessionStorage.clear());

describe("tab preference", () => {
  test("a room without a saved tab reads as null", () => {
    expect(loadTab("abc")).toBeNull();
  });

  test("the saved tab comes back for its room only", () => {
    saveTab("abc", "chat");
    expect([loadTab("abc"), loadTab("xyz")]).toEqual(["chat", null]);
  });

  test("a stored value that is no tab name reads as null", () => {
    sessionStorage.setItem("raceme.tab.abc", "settings");
    expect(loadTab("abc")).toBeNull();
  });
});
