// `stackful-fiber-pruned`: **a fiber artifact asks for no continuation feature.**
//
// I85, in one assertion. The `fiber` backend's suspension is `scheduler::park` —
// a call the host turns into a fiber switch — so nothing in the module needs a
// continuation type or a tag. Before DL37 it declared both anyway, because the
// shell it was built from was the continuation shell; an engine with stack
// switching compiled out then refused to parse the module before any of this
// could run. That was the whole Windows blocker (I16).
//
// The assertion is on the bytes, not on a `.wat`: the text format drops the tag
// section, and the type section's encoding is what a loader reads. The reader is
// shared with `stackful-fiber-section` (`stackful-wasm.mjs`) so both tests ask
// the same question the same way.
//
// **Two builds, and the second is the control.** The same source compiled with the
// default backend must *have* a continuation type and a tag section — otherwise a
// compiler that emitted none of this for anybody would pass this test.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as asc from "../../dist/asc.js";
import { compositeTypeForms, sections } from "./stackful-wasm.mjs";

/** `(cont …)` in the GC encoding's composite-type form. */
const CONT_FORM = 0x5d;
/** The tag section's id. */
const TAG_SECTION = 13;

const here = fileURLToPath(new URL(".", import.meta.url));
const sources = {
  "stackful-fiber-pruned.ts": readFileSync(join(here, "stackful-fiber-pruned.ts"), "utf8"),
  "stackful-fiber-record.ts": readFileSync(join(here, "stackful-fiber-record.ts"), "utf8"),
};
const entry = "stackful-fiber-pruned.ts";

/** Compiles in `backend` mode to a real file and answers its bytes. */
async function emit(backend, outPath, extra = []) {
  const { error } = await asc.main(
    [
      entry,
      "--outFile", outPath,
      "--runtime", "incremental",
      "--enable", "threads",
      "--sharedMemory",
      "--importMemory",
      "--initialMemory", "2",
      "--maximumMemory", "256",
      "--optimizeLevel", "0",
      `--stackful-backend=${backend}`,
      ...extra,
    ],
    {
      readFile: (name) => {
        for (const [file, text] of Object.entries(sources)) {
          if (name === file || name.endsWith(`/${file}`)) return text;
        }
        return null;
      },
      writeFile: (name, contents) => {
        if (name.endsWith(".wasm")) writeFileSync(name, contents);
      },
      listFiles: () => [entry],
    },
  );
  if (error) throw Error(`${backend} compile failed: ${error.message}`);
  return readFileSync(outPath);
}

/** `true` when the module declares a continuation type or any tag. */
function declaresContinuationMachinery(bytes) {
  const forms = compositeTypeForms(bytes);
  const cont = forms.get(CONT_FORM) || 0;
  const tags = sections(bytes).filter((section) => section.id === TAG_SECTION).length;
  return { cont, tags };
}

const dir = mkdtempSync(join(tmpdir(), "dl37-pruned-"));
try {
  // ── the claim: a fiber build has neither ─────────────────────────────────
  const fiber = await emit("fiber", join(dir, "fiber.wasm"));
  const fiberMachinery = declaresContinuationMachinery(fiber);
  if (fiberMachinery.cont !== 0) {
    throw Error(
      `the fiber artifact declares ${fiberMachinery.cont} continuation type(s) ` +
      `(form 0x${CONT_FORM.toString(16)}), so an engine without stack switching ` +
      `cannot parse it (I85)`,
    );
  }
  if (fiberMachinery.tags !== 0) {
    throw Error(
      `the fiber artifact declares ${fiberMachinery.tags} tag section(s), ` +
      `so it asks for a suspension mechanism it does not use`,
    );
  }

  // ── the flag is not what does it: same bytes with `--enable stack-switching`
  const withFeature = await emit("fiber", join(dir, "fiber-feature.wasm"), [
    "--enable", "stack-switching",
  ]);
  if (!Buffer.from(withFeature).equals(Buffer.from(fiber))) {
    throw Error(
      "compiling with --enable stack-switching produced different bytes, so fiber " +
      "mode still depends on the feature being declared",
    );
  }

  // ── the control: the default backend keeps both ───────────────────────────
  const plain = await emit("continuation", join(dir, "continuation.wasm"), [
    "--enable", "stack-switching",
  ]);
  const plainMachinery = declaresContinuationMachinery(plain);
  if (plainMachinery.cont === 0) {
    throw Error(
      "the continuation build declares no continuation type, so this test would " +
      "pass whether or not the fiber pruning worked",
    );
  }
  if (plainMachinery.tags === 0) {
    throw Error(
      "the continuation build declares no tag section, so the tag assertion proves nothing",
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
