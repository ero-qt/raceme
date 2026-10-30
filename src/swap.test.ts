import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const swap = join(import.meta.dir, "..", "deploy", "swap.sh");

describe("swap.sh", () => {
  // The raceme user writes `pending`, root reads it, so a path in it must never reach `ln` or `touch`.
  test("refuses a pending tag that isn't a version number", async () => {
    const dir = mkdtempSync(join(tmpdir(), "raceme-swap-"));
    const root = join(dir, "root");
    mkdirSync(join(root, "releases"), { recursive: true });
    mkdirSync(join(dir, "outside"));
    writeFileSync(join(dir, "outside", "commit"), "abc\n");
    writeFileSync(join(root, "pending"), "../../outside\n");
    writeFileSync(join(root, "swap"), "");

    const run = Bun.spawn(["bash", swap], {
      env: { ...process.env, RACEME_ROOT: root, RACEME_SYSTEMCTL: "true" },
      stdout: "ignore",
      stderr: "pipe",
      timeout: 3_000,
    });
    const code = await run.exited;
    const switched = existsSync(join(root, "current"));
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(switched).toBe(false);
  });
});
