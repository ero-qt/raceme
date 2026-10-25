import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { SiteHeader } from "./site-header.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("SiteHeader", () => {
  test("the name links home and opens it in the page", () => {
    let went = 0;
    const view = render(() => <SiteHeader onHome={() => went++} />);
    const home = view.getByRole("link", { name: "raceme" });
    fireEvent.click(home);

    expect(went).toBe(1);
  });

  test("the theme button cycles system, dark and light and remembers the pick", () => {
    const view = render(() => <SiteHeader onHome={() => {}} />);
    const button = view.getByRole("button", { name: "Theme: system" });
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(view.getByRole("button", { name: "Theme: dark" })).toBeTruthy();

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("raceme.theme")).toBe("light");

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("raceme.theme")).toBeNull();
  });

  test("starts from the remembered pick", () => {
    localStorage.setItem("raceme.theme", "light");
    const view = render(() => <SiteHeader onHome={() => {}} />);

    expect(view.getByRole("button", { name: "Theme: light" })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
