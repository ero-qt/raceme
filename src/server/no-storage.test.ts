import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

// Every way Bun or Node can write a file, start a program or print to the journal.
const storage =
  /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|writeSync|openSync|copyFile|copyFileSync|rename|renameSync|mkdir|mkdirSync)\b|Bun\.(write|spawn|spawnSync|file\([^)]*\)\.writer)|\.writer\(/;

describe("the server", () => {
  const files = [
    ...sourceFiles(join(root, "server")),
    ...sourceFiles(join(root, "shared")),
    join(root, "config.ts"),
    join(root, "index.ts"),
  ];

  test("has no code that writes a file or starts a program", () => {
    const hits = files.filter((file) => storage.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  // The journal would keep whatever the server prints, so only the startup lines go there.
  test("prints nothing after startup", () => {
    const hits = files.filter(
      (file) => !file.endsWith("/index.ts") && /console\./.test(readFileSync(file, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
