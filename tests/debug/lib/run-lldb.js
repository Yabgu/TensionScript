// Drive one fixture run under lldb and return what was observed.
//
// The inferior is the tension-core binary; lldb launches it with `--debug` and
// the compiled guest, then the host's wasmtime registers the JIT image through
// the GDB JIT interface. Breakpoints are set by source file and line.
//
// Two measured details the command file depends on:
//   * `settings set plugin.jit-loader.gdb.enable on` is what lets lldb see the
//     JIT image at all.
//   * the guest path is absolute and `--symbol-path` is passed. A bare relative
//     filename yields an empty DW_AT_comp_dir, which makes the host's line-table
//     prologue empty and panics wasmtime (index out of bounds in
//     line_program.rs). With a directory on the path the same guest compiles.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DRIVER = String.raw`
import lldb, json, re

dbg = lldb.debugger
target = dbg.GetSelectedTarget()
process = target.GetProcess()
max_stops = MAX_STOPS
UNAVAILABLE = "<unavailable>"

def reason_string(thread):
    reason = thread.GetStopReason()
    if reason == lldb.eStopReasonBreakpoint:
        count = thread.GetStopReasonDataCount()
        if count >= 2:
            return "breakpoint %d.%d" % (
                thread.GetStopReasonDataAtIndex(0), thread.GetStopReasonDataAtIndex(1))
        if count == 1:
            return "breakpoint %d" % thread.GetStopReasonDataAtIndex(0)
        return "breakpoint"
    if reason == lldb.eStopReasonSignal:
        return "signal"
    if reason == lldb.eStopReasonException:
        return "exception"
    if reason == lldb.eStopReasonPlanComplete:
        return "step"
    return "other"


def snapshot():
    thread = process.GetSelectedThread()
    frame = thread.GetFrameAtIndex(0)
    entry = frame.GetLineEntry()
    file = ""
    line = 0
    if entry and entry.IsValid():
        file = entry.GetFileSpec().GetFilename() or ""
        line = entry.GetLine() or 0
    # Read locals through the SB API, not the frame-variable command: the
    # interpreter keeps its own selected frame, which goes stale after
    # Continue() and returns nothing for the second stop.
    variables = []
    values = frame.GetVariables(True, True, False, False)
    for i in range(values.GetSize()):
        value = values.GetValueAtIndex(i)
        if not value or not value.IsValid():
            continue
        text = value.GetValue()
        variables.append({
            "type": value.GetTypeName() or "",
            "name": value.GetName() or "",
            "value": UNAVAILABLE if text is None else text,
        })
    return {
        "file": file,
        "line": line,
        "reason": reason_string(thread),
        "function": frame.GetFunctionName() or "",
        "variables": variables,
    }

stops = []
if process.GetState() == lldb.eStateStopped:
    stops.append(snapshot())

guard = 1
while guard < max_stops and process.GetState() == lldb.eStateStopped:
    process.Continue()
    if process.GetState() == lldb.eStateStopped:
        stops.append(snapshot())
    guard += 1

print("@@LLDB_JSON " + json.dumps({
    "stops": stops,
    "resolved": len(stops) > 0,
    "exit_state": process.GetState(),
}))
`;

/**
 * @param {{
 *   lldb: string,
 *   core: string,
 *   wasm: string,
 *   symbolPath: string,
 *   breakpoints: {file: string, line: number}[],
 *   workDir: string,
 *   maxStops?: number,
 * }} options
 */
export function runUnderLldb({ lldb, core, wasm, symbolPath, breakpoints, workDir, maxStops = 20 }) {
  fs.mkdirSync(workDir, { recursive: true });
  const driverPath = path.join(workDir, "driver.py");
  fs.writeFileSync(driverPath, DRIVER.replace("MAX_STOPS", String(maxStops)));
  const commandsPath = path.join(workDir, "lldb.cmds");

  const lines = [
    "settings set plugin.jit-loader.gdb.enable on",
    `settings set target.debug-file-search-paths "${symbolPath}"`,
  ];
  for (const bp of breakpoints) {
    lines.push(`breakpoint set -f "${bp.file}" -l ${bp.line}`);
  }
  lines.push("run");
  lines.push(`script exec(open(${JSON.stringify(driverPath)}).read())`);
  lines.push("quit");
  fs.writeFileSync(commandsPath, lines.join("\n") + "\n");

  const result = spawnSync(
    lldb,
    ["-b", "-s", commandsPath, "--", core, "--debug", "--symbol-path", symbolPath, path.resolve(wasm)],
    { encoding: "utf8", cwd: workDir, maxBuffer: 32 * 1024 * 1024 }
  );

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const line = output.split("\n").find((entry) => entry.startsWith("@@LLDB_JSON "));
  if (!line) {
    const tail = output.trim().split("\n").slice(-25).join("\n");
    throw new Error(`lldb produced no result (exit ${result.status}); last output:\n${tail}`);
  }
  const observed = JSON.parse(line.slice("@@LLDB_JSON ".length));
  return { ...observed, raw: output };
}
