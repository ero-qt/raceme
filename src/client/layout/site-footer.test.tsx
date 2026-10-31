import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { catalogCacheHours, roomLifetimeDays, sessionCookieDays } from "../../shared/retention.ts";
import { SiteFooter } from "./site-footer.tsx";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  cleanup();
});

describe("SiteFooter", () => {
  test("explains what the server keeps, with the real cookie and cache lifetimes", () => {
    const view = render(() => <SiteFooter />);

    const notice = view.getByText("privacy", { selector: "summary" }).parentElement;
    expect(notice?.textContent).toContain("raceme doesn't save anything about you.");
    expect(notice?.textContent).toContain(`deleted after ${roomLifetimeDays} days`);
    expect(notice?.textContent).toContain(`the other after ${sessionCookieDays} days`);
    expect(notice?.textContent).toContain(`kept for up to ${catalogCacheHours} hours`);
    expect(notice?.textContent).toContain("no accounts, no ads, no trackers.");
  });

  test("shows the release commit once the build note opens", async () => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    globalThis.fetch = mock(async () =>
      Response.json({
        release: "1.2.0",
        repository: "https://github.com/ero-qt/raceme",
        commit,
        digest: `sha256:${"b".repeat(64)}`,
      }),
    ) as unknown as typeof fetch;
    const view = render(() => <SiteFooter />);

    const details = view.getByText("build", { selector: "summary" })
      .parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    const link = await view.findByRole("link", { name: "0123456" });
    expect(link.getAttribute("href")).toBe(`https://github.com/ero-qt/raceme/commit/${commit}`);
    expect(details.textContent).toContain(`sha256:${"b".repeat(64)}`);
    expect(view.getByRole("link", { name: "ero-qt/raceme" }).getAttribute("href")).toBe(
      "https://github.com/ero-qt/raceme",
    );
    expect(view.getByRole("link", { name: "release 1.2.0" }).getAttribute("href")).toBe(
      "https://github.com/ero-qt/raceme/releases/tag/1.2.0",
    );
    expect(details.textContent).toContain("sha256sum raceme.tar.gz");
    expect(details.textContent).toContain(
      "gh attestation verify raceme.tar.gz --repo ero-qt/raceme --signer-workflow ero-qt/raceme/.github/workflows/release.yml",
    );
  });

  test("calls a build unverified when the server answers with something other than JSON", async () => {
    globalThis.fetch = mock(async () => new Response("<html>")) as unknown as typeof fetch;
    const view = render(() => <SiteFooter />);

    const details = view.getByText("build", { selector: "summary" })
      .parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(await view.findByText(/unverified build/)).toBeTruthy();
  });

  test("calls a build without a release unverified", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ release: null, repository: null, commit: null, digest: null }),
    ) as unknown as typeof fetch;
    const view = render(() => <SiteFooter />);

    const details = view.getByText("build", { selector: "summary" })
      .parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(await view.findByText(/unverified build/)).toBeTruthy();
  });
});
