# Binaryen and stack switching — what the compiler can and cannot emit

**Status:** a measurement record from the C1 spike (2026-11-16), at TensionScript
`f941a1f0`. **Nothing here is a plan.** It states what this Binaryen does, so that
no later round plans around a capability that is not there.

**Why it matters:** stackful `async`/`await` (Backend B, WasmFX) needs the compiler
to emit `cont.new` / `suspend` / `resume`, and the runtime already executes them —
`~/work/Tension/tension-core/tests/stack_switching.rs` proves `resume_throw`
against hand-written WAT on wasmtime 50.0.1. The question this file answers is
whether the *other* implementation agrees.

**The pin is upstream's, not the fork's drift.** `package.json` and AssemblyScript
at base `b6bda05c` both pin `binaryen: 131.0.0-nightly.20260721` (upstream's
`package.json` at that commit, fetched 2026-11-16). Everything below is that
Binaryen's behaviour, so it is upstream's at the base this fork was cut from.

---

## 1. The type declarations claim more than the runtime has

`node_modules/binaryen/index.d.ts:148-153` declares six members of the
`ExpressionIds` enum:

```ts
ContNew, ContBind, Suspend, Resume, ResumeThrow, StackSwitch,
```

The runtime `ExpressionIds` object has **83 keys and none of them**; it ends at
`StringSliceWTF`. The C surface exports the six **id constants**
(`_BinaryenContNewId` … `_BinaryenStackSwitchId`) and **no constructors**
(`_BinaryenContNew` is absent). `Features.StackSwitching` (1 << 16) *is* present.

Re-run:

```sh
cd ~/work/TensionScript   # or any package with binaryen installed
node -e '
import("binaryen").then((b) => {
  const m = b.default ?? b;
  const mod = new m.Module();
  for (const k of ["contNew","contBind","suspend","resume","resumeThrow","stackSwitch"])
    console.log(k, typeof mod[k]);                     // undefined, six times
  console.log("_BinaryenContNew:", "_BinaryenContNew" in m);  // false
  console.log("Feature:", m.Features.StackSwitching);          // 65536
});'
```

**Consequence — the load-bearing one: any plan that assumes
`module.contNew(...)` exists is wrong.** The AST builder cannot construct these
nodes, so a compiler that lowers `await` by building IR nodes cannot emit a
Backend B park at all. Use a runtime probe (`typeof mod.contNew`) rather than the
`.d.ts` wherever a plan depends on this surface; the declarations are ahead of the
implementation.

## 2. The text front end *can*, so the gap is the builder and the writer only

`parseText` accepts a module written in WAT and `emitText` round-trips it
faithfully — continuation types, `suspend`, `resume` with `(on $tag $label)`,
`elem declare`, tags and all:

```sh
cat > /tmp/c1/park.wat <<'WAT'
(module
  (type $ft (func))
  (type $ct (cont $ft))
  (tag $yield (type $ft))
  (global $started (mut i32) (i32.const 0))
  (func $body (global.set $started (i32.const 1)) (suspend $yield))
  (elem declare func $body)
  (func (export "park_and_finish") (result i32)
    (block $parked (result (ref null $ct))
      (resume $ct (on $yield $parked) (cont.new $ct (ref.func $body)))
      (return (i32.const 99)))
    (resume $ct)
    (global.get $started)))
WAT
node -e '
import("binaryen").then((b) => {
  const m = b.default ?? b;
  const fs = require("node:fs");
  const mod = m.parseText(fs.readFileSync("/tmp/c1/park.wat", "utf8"));
  mod.setFeatures(m.Features.StackSwitching | m.Features.ExceptionHandling
                 | m.Features.ReferenceTypes);
  console.log("validate:", mod.validate());           // 1
  const bin = mod.emitBinary();
  fs.writeFileSync("/tmp/c1/park.wasm", bin);
  console.log("emitted:", bin.length, "bytes");
});'
```

`validate()` answers 1 and `emitBinary()` succeeds. The output is 103 bytes.

## 3. The writer emits a type encoding two forms behind the final spec

wasmtime 50.0.1 refuses those bytes — a **parse** error, not a validation error:

```
$ ~/.cargo/bin/wasmtime run -W stack-switching=y --invoke park_and_finish /tmp/c1/park.wasm
Error: failed to parse WebAssembly module

Caused by:
    invalid continuation type (at offset 0x10)
```

The same WAT through `wat` 1.263.0 (`wat::parse_str`) is canonical and runs:

```
$ ~/.cargo/bin/wasmtime run -W stack-switching=y --invoke park_and_finish /tmp/c1/park-canonical.wasm
1
```

and under the runtime's own sandbox engine config
(`engines::engine_config(WorldKind::Sandbox, false)`) the canonical bytes compile,
instantiate and return `Ok(1)`.

**Two encodings differ, and nothing else does.** Aligning the code sections at the
block header, the instruction streams are byte-identical — `d2 00 e0 01 e3 01 01 00
00 00 41 e3 00 0f 0b e3 01 00 23 00 0b` on both sides (`ref.func 0`, `cont.new $ct`,
`resume $ct` with one `(on $yield)` entry, `return 99`, `resume $ct`,
`global.get`, `end`).

| what | Binaryen 131 emits | canonical | why |
| --- | --- | --- | --- |
| `(type $ct (cont $ft))` | `5d 70` | `5d 00` | `0x70` is the `funcref` heap type; wasmparser reads `var_s33` and needs a non-negative **type index**, so `0x70` decodes to −16 |
| block result | `02 68` | `02 63 01` | `0x68` is the abstract `contref`; the draft's final form is `0x63 <typeidx>` (a nullable concrete `cont` ref) |

```
$ od -An -tx1 -v /tmp/c1/park.wasm | head -2
00 61 73 6d 01 00 00 00 01 0a 03 60 00 00 5d 70        # type section
```

wasmparser's own rule, for the reader who wants the source rather than the claim:
`$CARGO_HOME/registry/src/*/wasmparser-0.263.0/src/readers/core/types.rs`,
`impl FromReader for ContType` — `read_var_s33` → `PackedIndex::from_module_index`,
`bail!(… "invalid continuation type")`.

**The defect is in writing, not in reading backwards.** Repairing only those two
encodings by hand — one byte in the type section, one byte plus a length for the
block — produces a 104-byte module that wasmtime accepts and runs (`Ok(1)`,
both from the CLI and from a Rust test under the sandbox engine config). Everything
else Binaryen wrote is correct.

## 4. Binaryen cannot read its own continuation output

```sh
$ ~/work/TensionScript/node_modules/binaryen/bin/wasm-dis -all /tmp/c1/park.wasm
[parse exception: cont types must be built from function types]
Fatal: error parsing wasm (try --debug for more info)
```

and the JS reader fails too — `readBinary()` on its own bytes throws, and on the
*canonical* bytes it parses but re-emits `5d 70` / `02 68` again
(`readBinary(canonical) → emitBinary()` = 103 bytes where canonical is 166,
`identical? false`). So a round trip through Binaryen cannot preserve a
continuation module even when it starts from one that is correct.

## 5. What this means, stated without a plan

- The **runtime** side of Backend B is real: wasmtime 50.0.1 executes canonical
  continuation encodings, including across nested guest frames.
- The **compiler** side is not available in this Binaryen: no AST constructors, and
  a writer that emits an encoding the runtime refuses. Both are upstream defects at
  the base commit, so whichever way they are worked around, the workaround is
  permanent until upstream fixes them.
- Any decision about *how* to work around it (patch Binaryen, post-process the
  emitted bytes, or emit text and convert with a Rust tool) is a decision, not a
  measurement, and is not taken here.

Two named restrictions that travel with this, measured in the same round and
recorded where the async contract can cite them:

- **A continuation cannot suspend below a host re-entry.** A guest that calls a
  host function, which calls back into a guest export that `suspend`s, traps
  `unhandled tag`; the same park reached through guest frames only works. The
  store survives, so it is a scoped limitation rather than a corruption.
- **`ContRef` cannot be handed to the host** in wasmtime 50.1 (`pub struct
  ContRef;`, wasmtime#10248), which is why the runtime's own round trip keeps the
  continuation in a wasm table and the host sees only an `i32`.
