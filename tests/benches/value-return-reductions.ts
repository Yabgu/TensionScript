// Two value-return defects found on 0.11.0 while converting the Tension engine's
// `class Quat` to `struct Quat`. They are recorded together because they were
// found together; **whether they share a root cause is not established** — see
// "What is and is not proven" at the bottom.
//
// ── Defect A: an inline-struct local whose name is reused across scopes
//    crashes the compiler ─────────────────────────────────────────────────
//
// Reusing one name for an `@inline` struct local in two sibling loops (A1), in
// the two arms of an `if` (A2), or in a scope that shadows an outer one (A3,
// A4) aborts compilation:
//
//   Error: duplicate local name
//       at Program.addLocal (src/program.ts:4306)
//       at Compiler.compileSroaLocal (src/compiler.ts:12259)
//       at Compiler.compileVariableStatement (src/compiler.ts:3742)
//       at Compiler.compileStatement (src/compiler.ts:2708)
//       at Compiler.compileStatements (src/compiler.ts:2751)
//       at Compiler.doCompileForStatement (src/compiler.ts:3059)
//
// **The name is what matters, not the shape.** Renaming the second local makes
// the identical program compile (A5 is the control). That points at the SROA
// local being named without its scope, so two scopes mint the same name and
// `addLocal` refuses the second. Plain shadowing — legal TypeScript, ordinary in
// a loop — is enough to trigger it.
//
// ── Defect B: a value return that corrupts memory under sustained load ────
//
// Not reducible to a snippet, and not in this file. The engine's conversion
// compiles clean and passes every fixture, then faults at ~1,500 evaluator
// frames: a memory fault at `0xb7b50008` — a float bit pattern, i.e. a
// quaternion component used as a pointer — deterministic, identical under
// `--target debug` and `--target release`, and heap-layout sensitive (one
// `print` in the loop makes 3,000 frames pass).
//
// The full reproducer lives with the engine, because nothing smaller reproduces:
//   Tension/tension-framework/tests/benches/quat-value-bench.ts
//
// Eight reductions were tried against it; every one is clean at 1M+ iterations
// or at 1k-3k frames. The closest differs only in having the engine's
// `bracketOf`/`TrackIndex` walk between two value-returning calls.
//
// ── Running ──────────────────────────────────────────────────────────────
//
// Defect A is a compile-time failure, so `run-reductions.sh` compiles each case
// on its own and reports which are still rejected. This file as a whole is
// expected NOT to build on 0.11.0. A fix turns every case green; a partial fix
// shows up as a subset still failing.
//
//   bash tests/benches/run-reductions.sh

struct Q {
  x: f32 = 0;
  y: f32 = 0;
  z: f32 = 0;
  w: f32 = 1;
}

/** A value-returning producer, so each case is a call and not a literal. */
function mk(a: f32): Q {
  let q: Q;
  q.x = a;
  q.y = a;
  q.z = a;
  q.w = a;
  return q;
}

// ── A1: two sibling loops, the same local name ───────────────────────────
// The first case found. Renaming the second `q` to `q2` makes it compile, which
// is the whole evidence that the name rather than the shape is the trigger.
export function siblingLoops(n: i32): f64 {
  let acc: f64 = 0;
  for (let i = 0; i < n; i++) {
    const q = mk(<f32>i);
    acc += <f64>q.x;
  }
  for (let i = 0; i < n; i++) {
    const q = mk(<f32>i);
    acc += <f64>q.w;
  }
  return acc;
}

// ── A2: the two arms of an if ────────────────────────────────────────────
export function siblingBranches(n: i32): f64 {
  let acc: f64 = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 == 0) {
      const q = mk(<f32>i);
      acc += <f64>q.x;
    } else {
      const q = mk(<f32>(i * 2));
      acc += <f64>q.w;
    }
  }
  return acc;
}

// ── A3: plain shadowing — an outer local and a loop local ────────────────
// The mildest form, and the one that matters most: this is ordinary code.
export function shadowOuter(n: i32): f64 {
  let acc: f64 = 0;
  const q = mk(9);
  for (let i = 0; i < n; i++) {
    const q = mk(<f32>i);
    acc += <f64>q.x;
  }
  acc += <f64>q.w;
  return acc;
}

// ── A4: shadowing across two nested loops ────────────────────────────────
export function nestedLoops(n: i32): f64 {
  let acc: f64 = 0;
  for (let i = 0; i < n; i++) {
    const q = mk(<f32>i);
    for (let j = 0; j < 3; j++) {
      const q = mk(<f32>(j + 1));
      acc += <f64>q.y;
    }
    acc += <f64>q.x;
  }
  return acc;
}

// ── A5: the control — distinct names, so no scope mints a duplicate ──────
export function control(n: i32): f64 {
  let acc: f64 = 0;
  for (let i = 0; i < n; i++) {
    const q = mk(<f32>i);
    const q2 = mk(<f32>(i + 1));
    acc += <f64>(q.x + q2.w);
  }
  return acc;
}

// ── What is and is not proven ────────────────────────────────────────────
//
// Proven:
//   * A1-A4 are rejected by the compiler; A5 compiles. Renaming the duplicated
//     local in A1 makes it compile. Every failure is at `compileSroaLocal`.
//   * Defect B corrupts memory in the engine's build, with the evidence in
//     `quat-value-bench.ts`'s header.
//
// NOT proven:
//   * That A and B share a cause. A is a refusal; B is silent corruption after a
//     clean compile. Scope-insensitive SROA naming would explain both — a shared
//     name refused in one place and aliased in another — but no experiment yet
//     connects them, and B has no reduction below the engine's call graph.
//   * That B is sret-related. "sret/SROA" in the engine's commit describes the
//     shape, not a diagnosis.
