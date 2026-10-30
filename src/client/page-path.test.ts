import { describe, expect, test } from "bun:test";
import { homePath, pagePath } from "./page-path.ts";

describe("homePath", () => {
  // The start page has no trailing slash, so a shared link reads ero-qt.eu/apps/raceme.
  test("drops the trailing slash of a base path", () => {
    expect([homePath("/apps/raceme/"), homePath("/")]).toEqual(["/apps/raceme", "/"]);
  });
});

describe("pagePath", () => {
  test("gives the path below the base path, with or without a trailing slash", () => {
    expect([
      pagePath("/apps/raceme", "/apps/raceme/"),
      pagePath("/apps/raceme/", "/apps/raceme/"),
      pagePath("/apps/raceme/abcdefghij", "/apps/raceme/"),
      pagePath("/missing", "/"),
    ]).toEqual(["/", "/", "/abcdefghij", "/missing"]);
  });
});
