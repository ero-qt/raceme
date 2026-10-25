import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflows = join(import.meta.dir, "..", ".github", "workflows");

function actionPins(): Map<string, Set<string>> {
  const pins = new Map<string, Set<string>>();
  for (const file of readdirSync(workflows)) {
    const text = readFileSync(join(workflows, file), "utf8");
    for (const [, action, ref] of text.matchAll(/uses:\s*([\w.-]+\/[\w./-]+)@(\S+)/g)) {
      pins.set(action as string, (pins.get(action as string) ?? new Set()).add(ref as string));
    }
  }
  return pins;
}

describe("workflow pins", () => {
  test("uses each action's major version tag", () => {
    for (const [action, refs] of actionPins()) {
      for (const ref of refs) {
        expect([action, ref]).toEqual([action, expect.stringMatching(/^v\d+$/)]);
      }
    }
  });

  // Dependabot updates one file at a time, so 2 workflows can drift onto different versions.
  test("uses the same version of an action in every workflow", () => {
    for (const [action, refs] of actionPins()) {
      expect([action, refs.size]).toEqual([action, 1]);
    }
  });
});
