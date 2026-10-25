import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStatic } from "./static.ts";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "raceme-static-"));
  await Bun.write(join(dir, "index.html"), "index");
  await Bun.write(join(dir, "assets", "app-abc123.js"), "app");
});

afterAll(() => rm(dir, { recursive: true }));

describe("serveStatic", () => {
  test("serves hashed assets as immutable", async () => {
    const response = await serveStatic(dir, "/assets/app-abc123.js");
    expect(await response.text()).toBe("app");
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  test("falls back to index.html for client routes", async () => {
    expect(await (await serveStatic(dir, "/r/abcdefghij")).text()).toBe("index");
  });

  test("never leaves the static folder", async () => {
    expect(await (await serveStatic(dir, "/../../etc/passwd")).text()).toBe("index");
  });
});
