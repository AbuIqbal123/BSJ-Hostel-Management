import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

const root = path.join(__dirname, "..");

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...filesUnder(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

/** A screen that builds its own page size fails here. The shared query lives in list-page.ts. */
describe("shared page size", () => {
  it("keeps limit off every screen, and on the page helper", () => {
    const targets = [...filesUnder(path.join(root, "app")), ...filesUnder(path.join(root, "components")), path.join(root, "session.tsx")];
    const offenders: string[] = [];
    for (const file of targets) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (/limit\s*[:=]/.test(line)) {
          offenders.push(`${path.relative(root, file)}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
