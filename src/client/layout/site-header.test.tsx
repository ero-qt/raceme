import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { SiteHeader } from "./site-header.tsx";

afterEach(cleanup);

describe("SiteHeader", () => {
  test("the name links home and opens it in the page", () => {
    let went = 0;
    const view = render(() => <SiteHeader onHome={() => went++} />);
    const home = view.getByRole("link", { name: "raceme" });
    fireEvent.click(home);

    expect(went).toBe(1);
  });
});
