// Runs the four showcase programs and asserts on their transcripts.
//
// The programs print `tag: value`, one observation per line. This test parses
// the values and compares numbers; prose lines would be asserted as containing
// the exact text, but the guests do not print prose — the tag names live in
// `run.mjs`, so the transcript is stable and the assertion is about behaviour.
//
// Run: npm run test:examples (Node must have --experimental-wasm-wasmfx).

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  ++checks;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

/** Runs one example and returns `{ tag: [values…] }`. */
function runExample(name) {
  const out = execFileSync(process.execPath, [
    join(root, "scripts", "run-wasmfx.js"),
    join(root, "examples", name, "run.mjs"),
  ], { encoding: "utf8", timeout: 60000 });
  const tags = {};
  for (const line of out.split("\n")) {
    const match = /^([a-z0-9-]+): (-?\d+)$/.exec(line.trim());
    if (!match) continue;
    (tags[match[1]] ??= []).push(Number(match[2]));
  }
  return { out, tags };
}

function one(tags, name) {
  const values = tags[name];
  return values && values.length === 1 ? values[0] : null;
}

// ---------------------------------------------------------------------------
// 1. async-main: no threads, seven suspensions, a value that needs all of them.
// ---------------------------------------------------------------------------
console.log("\n# async-main");
{
  const { tags, out } = runExample("async-main");
  check("three loop iterations carried their local", tags.carried, [11, 12, 13]);
  check("seven suspensions (one task created early, awaited last)", one(tags, "suspensions"), 7);
  check("the loop's total", one(tags, "total"), 33);
  check("the chained final value", one(tags, "final"), 1150);
  check("main's status is the final value", one(tags, "status"), 1150);
  check("there is no pool and no worker in the transcript", /pool-size|worker/.test(out), false);
}

// ---------------------------------------------------------------------------
// 2. thread-pool: 12 tasks, every value once, at least two executors.
// ---------------------------------------------------------------------------
console.log("\n# thread-pool");
{
  const { tags } = runExample("thread-pool");
  check("the pool started three workers", one(tags, "pool-size"), 3);
  check("no post failed", tags["post-failed"], undefined);
  const values = (tags["result-value"] ?? []).slice().sort((a, b) => a - b);
  const expected = Array.from({ length: 12 }, (_, i) => i * 1000 + i);
  check("every value arrived exactly once", values, expected);
  const executors = tags["result-executor"] ?? [];
  check("twelve answers", executors.length, 12);
  check("every answer names a worker", executors.every((e) => e >= 1 && e <= 3), true);
  check("more than one executor served", new Set(executors).size >= 2, true);
  check("the result count", one(tags, "results"), 12);
  check("the value sum", one(tags, "sum"), 66066);
  check("the executor bits are workers 1..3", one(tags, "executors"), 0b1110);
}

// ---------------------------------------------------------------------------
// 3. masking: one refusal, one allowed run, one park violation.
// ---------------------------------------------------------------------------
console.log("\n# masking");
{
  const { tags } = runExample("masking");
  check("one worker", one(tags, "pool-size"), 1);
  check("admission refused the disallowed target once", one(tags, "admission-refusals"), 1);
  check("the same task with the right mask ran once", one(tags, "allowed-runs"), 1);
  check("the mis-placed park counted one violation", one(tags, "park-violations"), 1);
  check("no post failed", tags["post-failed"], undefined);
}

// ---------------------------------------------------------------------------
// 4. policies: the four shapes and their counts.
// ---------------------------------------------------------------------------
console.log("\n# policies");
{
  const { tags } = runExample("policies");
  check("one worker", one(tags, "pool-size"), 1);
  check("the default ran no body at the call", one(tags, "lazy-body-before-await"), 0);
  check("the default returned its value", one(tags, "lazy-value"), 1);
  check("eager ran the prefix at create", one(tags, "eager-body-at-create"), 1);
  check("eager returned its value", one(tags, "eager-value"), 2);
  check("two calls, two creates", one(tags, "counting-created"), 2);
  check("two calls, two awaits", one(tags, "counting-awaited"), 2);
  check("create saw no body", one(tags, "counting-body-at-create"), 0);
  check("the two values summed", one(tags, "counting-sum"), 30);
  check("the remote task's value", one(tags, "remote-value"), 42);
  check("the body ran on worker 1", one(tags, "remote-worker"), 1);
}

if (failures) {
  console.error(`\nexamples: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
