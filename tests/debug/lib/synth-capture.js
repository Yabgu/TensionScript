// Capture the module the CURRENT host hands wasmtime, for the structural
// baseline.
//
// tension-core synthesises DWARF into an in-memory copy of the guest and never
// writes it to disk (main.rs:582, main.rs:617-621). The only in-tree writer of
// the synthesised bytes is the Rust test at dwarf/mod.rs:845, and that test is
// bound to examples/io and asserts io-specific locals (`n`, `i`, `line`). Point
// it at another fixture's source map and it either skips or asserts the wrong
// thing before writing — so it cannot produce a truthful baseline for a new
// fixture.
//
// Instead this captures the exact bytes the host passes to Module::new: run the
// host under lldb, stop at the entry of `Module::new`, and read the `&Vec<u8>`
// argument out of the process. That is the host's output, not a re-render of it.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DRIVER = String.raw`
import lldb, struct

dbg = lldb.debugger
target = dbg.GetSelectedTarget()
process = target.GetProcess()
frame = process.GetSelectedThread().GetSelectedFrame()
err = lldb.SBError()
words = []

# The argument is &Vec<u8>. Rust does not promise Vec's field order, so read
# the three words and find the one that points at a wasm magic number.
base = frame.FindRegister("rsi").GetValueAsUnsigned()
raw = process.ReadMemory(base, 24, err)
if raw and len(raw) == 24:
    words = list(struct.unpack("<3Q", raw))

pointer = None
for word in words:
    if 0x10000 < word < 0x7FFFFFFFFFFF:
        head = process.ReadMemory(word, 4, err)
        if head == b"\x00asm":
            pointer = word
# Vec's fields are (ptr, cap, len) or (cap, ptr, len); len is the third word in
# both layouts, which is why it is read by position rather than by value.
length = words[2] if len(words) == 3 else None
if pointer is None or not length:
    print("@@SYNTH_ERROR could not locate the module in Module::new's arguments")
else:
    blob = process.ReadMemory(pointer, length, err)
    open(OUT_PATH, "wb").write(blob)
    print("@@SYNTH_OK %d" % len(blob))
`;

/**
 * @param {{lldb: string, core: string, wasm: string, symbolPath: string, workDir: string, outFile: string}} options
 */
export function captureSynthesized({ lldb, core, wasm, symbolPath, workDir, outFile }) {
  fs.mkdirSync(workDir, { recursive: true });
  const driverPath = path.join(workDir, "capture.py");
  fs.writeFileSync(driverPath, DRIVER.replace("OUT_PATH", JSON.stringify(outFile)));
  const commandsPath = path.join(workDir, "capture.cmds");
  fs.writeFileSync(
    commandsPath,
    [
      "breakpoint set -n '<wasmtime::runtime::module::Module>::new::<&alloc::vec::Vec<u8>>'",
      "run",
      `script exec(open(${JSON.stringify(driverPath)}).read())`,
      "quit",
    ].join("\n") + "\n"
  );

  const result = spawnSync(
    lldb,
    ["-b", "-s", commandsPath, "--", core, "--debug", "--symbol-path", symbolPath, path.resolve(wasm)],
    { encoding: "utf8", cwd: workDir, maxBuffer: 32 * 1024 * 1024 }
  );
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (!output.includes("@@SYNTH_OK")) {
    const tail = output.trim().split("\n").slice(-20).join("\n");
    throw new Error(`could not capture the synthesised module; last output:\n${tail}`);
  }
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
    throw new Error(`capture reported success but ${outFile} is missing or empty`);
  }
  return outFile;
}
