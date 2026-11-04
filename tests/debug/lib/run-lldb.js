// Drive one fixture run under lldb and return what was observed.
//
// The inferior is standalone Wasmtime (`wasmtime run -D debug-info`), not the
// Tension engine: the guest is the one this repo's compiler emits, and it
// carries its own DWARF, so nothing has to supply debug info at load time.
// Breakpoints are set by source file and line before the process starts.
//
// Two measured details the command file depends on:
//   * `settings set plugin.jit-loader.gdb.enable on` is what lets lldb see the
//     JIT image at all (measured against wasmtime 24.0.13, the pinned
//     consumer).
//   * the guest path is absolute. `--invoke` names the fixture's export
//     (`_start_game`); Wasmtime's default entry point `_start` does not exist
//     in these fixtures.

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
 *   wasmtime: string,
 *   wasm: string,
 *   symbolPath: string,
 *   breakpoints: {file: string, line: number}[],
 *   workDir: string,
 *   invoke?: string,
 *   maxStops?: number,
 * }} options
 */
export function runUnderLldb({
  lldb,
  wasmtime,
  wasm,
  symbolPath,
  breakpoints,
  workDir,
  invoke = "_start_game",
  maxStops = 20,
}) {
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

  // No `-O opt-level=0`: the committed baseline was captured from the engine's
  // embedded wasmtime with Cranelift's default opt level, and lowering it
  // changes which locals the debugger can read (measured — see
  // tests/debug/README.md). The consumer must stay the one that produced the
  // baseline, not merely a recent one.
  const result = spawnSync(
    lldb,
    ["-b", "-s", commandsPath, "--", wasmtime, "run", "-D", "debug-info",
      "--invoke", invoke, path.resolve(wasm)],
    { encoding: "utf8", cwd: workDir, maxBuffer: 32 * 1024 * 1024 }
  );

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const line = output.split("\n").find((entry) => entry.startsWith("@@LLDB_JSON "));
  if (!line) {
    const tail = output.trim().split("\n").slice(-25).join("\n");
    // Distinguish "lldb never got the process running" from "it ran and the
    // breakpoint never resolved" - two different failures for a reader.
    if (/executable found|Attaching|attach|failed to launch|process launch failed/i.test(output)) {
      throw new Error(
        `lldb could not attach to wasmtime (exit ${result.status}); last output:\n${tail}`
      );
    }
    throw new Error(`breakpoint never resolved (exit ${result.status}); last output:\n${tail}`);
  }
  const observed = JSON.parse(line.slice("@@LLDB_JSON ".length));
  return { ...observed, raw: output };
}
