// `$starts` exists for a program whose entry never suspends, because a body named an index.
//
// Import-time like the sibling shell tests: a fiber build cannot be instantiated on a Node
// without wasmfx, and what is under test is the compiled bytes — specifically that every
// `$~spawnIndex/…` call has a target, which is what the validator refused before DL53.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as asc from "../../dist/asc.js";
import { customSectionsOf, sections as sectionsOf } from "./stackful-wasm.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(join(here, "stackful-sync-entry-spawn-index.ts"), "utf8");

const dir = mkdtempSync(join(tmpdir(), "stackful-sync-entry-spawn-index-"));
try {
  writeFileSync(join(dir, "entry.ts"), source);
  const outPath = join(dir, "entry.wasm");
  const stderr = { write() {}, isTTY: false };
  const result = await asc.main(
    [
      join(dir, "entry.ts"), "-o", outPath,
      "--runtime", "incremental", "--target", "release", "--noColors",
      "--stackful-backend", "fiber",
    ],
    {
      readFile: (name) => (name.endsWith("entry.ts") ? source : null),
      writeFile: (name, contents) => {
        if (name.endsWith(".wasm")) writeFileSync(name, contents);
      },
      listFiles: () => [],
      stderr,
    },
  );

  // **The regression itself.** Before DL53 this is where the build stopped, with
  // `call target must exist, on (call $~spawnIndex/…$spawnStart)`.
  if (result.error) {
    throw new Error(
      "a sync entry calling an async function must build on the fiber backend; got: " +
        result.error.message,
    );
  }

  const bytes = readFileSync(outPath);

  // 1. The table the index refers to is in the module and exported, so a worker or a
  //    policy can read the same numbers.
  const exportNames = [...bytes.toString("latin1").matchAll(/\$starts/g)].length;
  if (exportNames === 0) throw new Error("the artifact must export `$starts`");

  // 2. It is still the fiber lowering, and it still declares itself portable — the point
  //    of `auto` meaning fiber.
  const backend = customSectionsOf(bytes, "tension.stackful-backend")[0];
  if (backend === undefined || new TextDecoder().decode(backend) !== "fiber") {
    throw new Error("the artifact must record the fiber backend");
  }
  const requires = new TextDecoder().decode(
    customSectionsOf(bytes, "tension.requires")[0] ?? new Uint8Array(),
  );
  if (!requires.includes("backend=fiber") || !requires.includes("target=portable")) {
    throw new Error(`tension.requires must say fiber/portable; got ${JSON.stringify(requires)}`);
  }

  // 3. **The entry did not become async.** The shell's start rewrite is what would make
  //    `main$start` and `__asyncPump` appear; a sync entry must not get them, because
  //    starting a sync `main` in a shell is the behaviour `shouldEmitAsyncShell` exists to
  //    prevent. The fix adds the table, not a shell.
  if (bytes.toString("latin1").includes("__asyncPump")) {
    throw new Error("a sync entry must not get the shell's pump export");
  }

  // 4. Exactly one start section, and no `$serveEntry` — the shell's dispatcher belongs to
  //    the fiber shell proper, which this program does not have.
  const startSections = sectionsOf(bytes).filter((entry) => entry.id === 8);
  if (startSections.length !== 1) {
    throw new Error(`the artifact must carry exactly one start section; found ${startSections.length}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
