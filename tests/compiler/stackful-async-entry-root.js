// The assertions for `stackful-async-entry-root`: an async `_start_game` builds, and the
// artifact is the one-start shape the host can actually drive.
//
// Import-time, like the sibling shell tests: a fiber build cannot be instantiated on a Node
// without wasmfx, and what is under test is the compiled bytes.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as asc from "../../dist/asc.js";
import { customSectionsOf, sections as sectionsOf } from "./stackful-wasm.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(join(here, "stackful-async-entry-root.ts"), "utf8");

const dir = mkdtempSync(join(tmpdir(), "stackful-async-entry-root-"));
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

  // 1. It builds. Before DL54 this is where an async `_start_game` either got no shell
  //    (and produced a task factory the host refused) or, once the latch was widened alone,
  //    built a shell that called a factory whose body nothing dispatched.
  if (result.error) {
    throw new Error("an async _start_game must build on the fiber backend; got: " + result.error.message);
  }

  const bytes = readFileSync(outPath);
  const text = bytes.toString("latin1");

  // 2. The shell is prepared: `$starts` and the host-facing pump.
  if (!text.includes("$starts")) throw new Error("the artifact must export `$starts`");
  if (!text.includes("__asyncPump")) throw new Error("the artifact must export `__asyncPump`");

  // 3. **The boot body is an export, not a start section.** A session guest is refused
  //    outright when it declares a start section, and a plain guest's start section would
  //    run the entry at instantiation with no fiber to suspend on.
  if (!text.includes("__start")) throw new Error("the shell's boot body must be exported as `__start`");
  const startSections = sectionsOf(bytes).filter((entry) => entry.id === 8);
  if (startSections.length !== 0) {
    throw new Error(`a shell-owned entry must not also be a start section; found ${startSections.length}`);
  }

  // 4. **Exactly once.** The root is resumed by the shell, so the name the host looks for
  //    must not be in the export table: otherwise the host calls `__start` (which runs the
  //    entry) and then calls `_start_game` again. Measured before this assertion existed:
  //    the guest's whole transcript, twice.
  if (text.includes("_start_game")) {
    throw new Error(
      "a shell-owned entry must not be exported as `_start_game`: the host would run it twice",
    );
  }

  // 5. And it is the fiber lowering, declaring itself portable.
  const backend = customSectionsOf(bytes, "tension.stackful-backend")[0];
  if (backend === undefined || new TextDecoder().decode(backend) !== "fiber") {
    throw new Error("the artifact must record the fiber backend");
  }
  const requires = new TextDecoder().decode(customSectionsOf(bytes, "tension.requires")[0] ?? new Uint8Array());
  if (!requires.includes("backend=fiber") || !requires.includes("target=portable")) {
    throw new Error(`tension.requires must say fiber/portable; got ${JSON.stringify(requires)}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
