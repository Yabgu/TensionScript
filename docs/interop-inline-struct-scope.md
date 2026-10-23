# `@inline struct` (value types) — scoping, 1.0 minimum viable form

**Status:** scoping only. No source changed, no plan, no code, no PR.
**Base:** TensionScript `origin/main` @ `277eebaf` (0.9.0, "feat: 0.9.0 —
`@managed struct`"). The working checkout at `~/work/TensionScript` is at
`90c0d2fe` (0.8.1) and is **behind** `origin/main`; every source citation below
was read with `git show origin/main:<path>` and every behaviour claim was
measured with the published **0.9.0** compiler (`/tmp/tsprefix/bin/tensionscript`,
`Version 0.9.0`). Tension `origin/main` @ `5fdb63b` (PR 33 merged) was read only,
for one cross-reference to the adapter contract.
**Siblings:** `docs/interop-struct-keyword-scope.md` is the only other scoping in
this repository. The interop scopes named in the brief
(`interop-tn-scope.md`, `interop-0.8.0-scope.md`) are **not in this repo** — they
live in `~/work/Tension/docs` — so nothing here is beside them in the tree.
Neither they nor `docs/async-complete.md` were touched.
**Method.** Fixtures were compiled and executed in `/tmp/inline-probe/`; none is
in the repo. Instruction counts are read from the emitted `.wat`.

---

## 0. The answer up front

**Proceed — the minimum viable form is 1.0-sized, and one assumption in the
brief does not survive measurement.**

1. **There is no existing multi-byte, non-pointer local, and the nearest
   mechanism crashes.** Every local is a single WASM local (`i32`/`i64`); a
   fixed-array local (`let a: i32[4]`) is a compiler **assertion failure**, not a
   slow path (§2). So `@inline struct` locals need new codegen, as suspected.
2. **The shadow stack cannot hold the value.** The collector scans *every*
   4-byte word of the live frame (`visitStack`, `itcms.ts:167-173`, called once
   per cycle at `:207`) and `__visit` dereferences each word **without a bounds
   check** (`itcms.ts:322-330`). A C-layout record's bytes are not pointers, so a
   slot in the scanned frame can trap or write an object's colour in unrelated
   memory. **This rules out the "shadow-stack slot per local" option**, and it is
   the single finding that shapes the rest of this document (§4).
3. **The resulting shape:** per-field WASM locals (SROA) for the value itself —
   1 instruction per field access, no memory, no collector interaction — and a
   **non-scanned** temp only where a contiguous `sizeof<Foo>`-byte block is
   required (the `@external` boundary, §8). Passing and returning between guest
   functions are internal-convention changes (extra Wasm operands / a hidden
   destination pointer), not ABI changes.
4. **Zero ABI change, zero hash move, no adapter rebuild — measured, not
   assumed.** Both `@managed` and `@unmanaged` records already cross the host
   boundary as a single `i32` (§6); `layout_hash` folds host constants only
   (§13). The one thing that would have made this 2.0-sized — an `@inline struct`
   **returned** by an `@external` call — is scoped OUT with the reason (§9).
5. **The `alignof` builtin was wrong; the layout loop is not — FIXED in PR #9.**
   Every multi-alignment record reported the 4-byte `usize` base
   (`alignof<{u64}>` = 2, not 3), because `builtin_alignof` lacked the record
   branch that `builtin_sizeof` already has (§7). This scoping first claimed the
   *layout loop* shared the defect and that nested records were mislaid
   **today**; that was a pointer-model / C-inline conflation, corrected in §7
   against the A/APtr measurement. The loop is correct and must not be changed.
6. **Two adjacent defects found while measuring.** `DecoratorFlags.ManagedStruct`
   and `DecoratorFlags.Unsafe` were the **same bit** (`1 << 11`,
   `program.ts:3054`/`:3064`), which constrained the flag choice in §3 —
   **FIXED in PR #9** (`Unsafe` → `1 << 13`, `InlineStruct` reserved at
   `1 << 12`). Separately, the `@inline` reservation already reports correctly,
   so the syntax needs no new parser work (`program.ts:2101-2107`).

---

## 1. Measured pre-work

### 1.1 Tree state

| What | Value |
|---|---|
| TensionScript `origin/main` | `277eebaf` — 0.9.0 (`@managed struct`, PR 8); `package.json` `"version": "0.9.0"` |
| TensionScript local checkout | `90c0d2fe` — 0.8.1 (`package.json` `"version": "0.8.1"`), clean tree, **behind** `origin/main` |
| Tension `origin/main` (read only) | `5fdb63b` — PR 33 merged (toolchain floors) |
| `/tmp` worktrees | four remain: `tension-adopt`, `tension-adopt-base`, `tension-drift-impl`, `tension-drift-scope` (plus `/home/acakar/work/Tension-adopt09`). Not removed. |

The local checkout being behind is worth stating plainly: the 0.9.0 sources are
**not** in the working tree, so a `grep` of `src/` on disk reports 0.8.1. All
citations below name a revision.

### 1.2 Locals — every one is a single WASM local

Measured from `locals.wat` (probe in the appendix), `--optimizeLevel 0`:

- **Scalar** `let x: i32 = 7` → `(local $0 i32)`; `i32.const 7; local.set $0`.
- **`u64`** `let y: u64 = 5` → `(local $0 i64)`; `i64.const 5; local.set $0`.
- **Class reference** `let f: Foo = new Foo()` → `(local $0 i32)` **plus** a
  4-byte shadow-stack slot that roots it (`i32.store` through
  `global.get $~lib/memory/__stack_pointer`).
- **`@unmanaged` struct** `let u: Unm = changetype<Unm>(ptr)` →
  `(local $1 i32)`, and the body is `local.get $0; local.set $1`. It is a
  **4-byte pointer variable**; confirmed, as the brief expected.
- **`@managed` struct** `let m: Man = new Man()` → `(local $0 i32)` — the
  reference, which *is* the fields pointer — plus a rooting slot.

The declaration path is `compiler.ts:3358` (`flow.addScopedLocal(name, type)`
for `let`/`const`) or `:3372` (`flow.targetFunction.addLocal`), and the local's
WASM type comes from `type.toRef()` (`compiler.ts:8066`).

**The largest non-pointer local is 8 bytes** (`i64`/`f64`). There is no
mechanism above that, and the nearest one is broken:

```
$ tensionscript t.ts          # export function f(): i32 { let a: i32[4]; return 0; }
AssertionError: assertion failed
    at Type#toRef (src/types.ts:748)
    at compileIdentifierExpression (src/compiler.ts:8066)
```

Reproduced four ways — declaration only, declaration with an initializer,
declaration plus an element write, and as a `static` class field. `Type#toRef()`
has no `TypeKind.FixedArray` case and falls through to `assert(false)`
(`types.ts:746-749`). A global `const g = [0,0,0,0]` compiles (it is a managed
`Array`, not a fixed array).

### 1.3 Closure capture — a synthesized class, one store per binding

`src/closure/lower.ts` performs capture analysis and synthesizes an environment
**class** (`makeEnvClass`, `lower.ts:2142`; emitted by `makeEnvClasses`,
`:2118`). Measured for `let x: i32 = 7; let f = (): i32 => x + 1;`:

```
;; env allocation
global.get $~lib/memory/__stack_pointer
i32.const 0
call $capture/capture$Env#constructor      ; -> __lib/rt/itcms/__new(4, 4)
local.tee $0
;; capture
local.get $0
i32.const 7
call $capture/capture$Env#set:x            ; body: local.get 0; local.get 1; i32.store
```

So capture is **a heap allocation per closure environment**, and the capture
itself is the ordinary class-field store — one store of the value's width for a
scalar. The environment is a managed object, which matters for `@inline struct`
capture: a struct-typed field in a class is pointer-sized, so a value placed in
an env field would have to be stored **inline in the heap** — the deferred
inline-nesting case. §5.3 gives the narrow alternative.

### 1.4 `alignof` — measured per case

**Fixed in PR #9**; the table is the pre-fix measurement that defined the defect.
Log2 values, from `sizes.wasm`:

| Type | `alignof` | True alignment (log2) | |
|---|---|---|---|
| `u8` | **0** | 0 | correct |
| `u16` | **1** | 1 | correct |
| `u32` | **2** | 2 | correct |
| `u64` | **3** | 3 | correct |
| `f64` | **3** | 3 | correct |
| `@unmanaged {u16}` | **2** | 1 | **wrong** |
| `@unmanaged {u32, u64}` | **2** | 3 | **wrong** |
| `@unmanaged {u8, u32, u8}` | **2** | 2 | right by coincidence (4-byte record) |

Mechanism: `Type#alignLog2` is `31 - clz(byteSize)` (`types.ts:224-227`), and a
record's *Type* is a class-like reference whose `byteSize` is the 4-byte `usize`
— hence 2. `builtin_alignof` returns `type.alignLog2` with no record special
case (`builtins.ts:1311`), while `builtin_sizeof` has exactly that special case
for `Unmanaged | ManagedStruct` (`builtins.ts:1274-1283`). The record's true
alignment is already computed and stored: `Class.alignLog2`, "the strongest of
its fields', base included" (`program.ts:4556-4557`), accumulated in the layout
loop (`resolver.ts:3760-3762`) — which is correct for record-typed *fields*,
because those store a pointer (§7.1).

### 1.5 `sizeof` / `offsetof` for `@unmanaged` — the values `@inline` must match

Measured (`sizes.wasm`), against `@unmanaged struct ABC { a: i32; b: f64; c: i32 }`:

- `sizeof<ABC>()` = **24**
- `offsetof<ABC>()` (no field) = **24** — aliases `sizeof`
- `offsetof<ABC>("a")` = **0**, `("b")` = **8**, `("c")` = **16**
- `sizeof<{u16}>` = **2**; `sizeof<{u8, u32, u8}>` = **12**

All as the brief predicted. These are C-compatible, variant B (trailing padding
included), no header, no borrowed pointer — and they are the numbers an
`@inline struct` value must produce, because its whole purpose is to *be* that
record's value.

### 1.6 `@managed` at the host boundary — the reference, no temp

Measured (`hostbound.wat`). Both kinds import as one `i32`:

```
(import "host" "call_man" (func $hostbound/host_call_man (param i32)))
(import "host" "call_unm" (func $hostbound/host_call_unm (param i32)))
```

`passManaged` allocates the record, roots the reference in the frame, and calls
with `local.get $ref` — the reference itself, no copy. `passUnmanaged` is
`local.get $0; local.set $1; local.get $1; call` — the pointer, no copy.

**The `@managed struct` inventory in this repository** (relevant to the
`DecoratorFlags` finding in §3 and §16.2): **8 declarations across 7 files** —
`tests/compiler/interop/managed-struct.ts`, `-access.ts`, `-copy.ts`,
`-array.ts`, `-array-refs.ts`, `-inheritance.ts`, and
`tests/parser/struct-keyword.ts`. `managed-struct-inheritance.ts` declares two
(`Base`, `Sub`). (The fix PR's brief said "1 fixture"; that is Tension PR 32's
single consumer-side fixture, in the engine repository — not this one.)
**Corrected in PR #9:** an earlier draft of this document said 7 declarations;
the measured figure is 8 across 7 files (two of an initial grep's hits were
comment lines).

The host side of that contract (read-only cross-reference, Tension `5fdb63b`):
guest pointers are `uint32_t` at the boundary (`tension_adapter.h:45`), "An
adapter never caches a pointer into guest memory" (`:57`), and the vtable is
frozen at `TENSION_ADAPTER_ABI_VERSION 3u` (`:78`).

**Consequence for `@inline struct`:** `@managed` needs no temp because a
reference exists and *is* the fields pointer. `@inline struct` has no reference,
so a temp must be built — the mechanism is §8.

---

## 2. The bounded scope (ratified OUT list)

In: `@inline struct` declarations with scalar fields; locals; field read/write;
assignment; passing to guest functions; passing to `@external` calls via a temp;
capture by value; internal return values.

Out, with the reason:

| Out | Reason |
|---|---|
| Inline nesting (`@inline struct` field inside `@inline struct`) | Needs inline-in-record layout; see §7 for the layout defect it would inherit. Rule designed in §10.1; code not scoped. |
| `T[N]` of `@inline struct` elements | Needs per-element construction and a fill path; the `makeZero` gap below is the immediate blocker. |
| `T[N]` in an `@inline struct` with non-literal `N` | **Permanent.** WASM locals are fixed-size at compile time; a non-literal `N` cannot be reserved. Not a phase limit — a property of the target. |
| `ref` / `out` / `in` modifiers | Separate parameter-passing feature. |
| `stackalloc` | A stack *pointer* type — a different feature with an unsafe surface. |
| `Span<T>` / `ref struct` | Stack-only view types; depend on `stackalloc`. |
| By-value ABI beyond a temp for `@external` | The host ABI has no struct-by-value form (WASM has none either); a temp pointer is the whole story. |
| `@inline struct` in `Array<T>` | Shape question in §10.4; no answer scoped. |
| `@inline struct` as a class field | A class field is a pointer slot; inline-in-heap is the nesting case. |
| `@inline struct` returned by `@external` | Would need an ABI change; see §9. |

---

## 3. Type kind representation

**Precedent, cited.** `@managed struct` is a decorator flag, not a `TypeKind`:
`DecoratorFlags.ManagedStruct = 1 << 11` (`program.ts:3054`) and the parser marks
`declaredAsManagedStruct` (`parser.ts:413`), from which the prototype takes
`ManagedStruct` and is forced `Final` (`program.ts:2109-2132`). Everything else
— `sizeof`, `COPY_STRUCT` refusal, field access — reads the flag
(`builtins.ts:1277`, `compiler.ts:6282`, `resolver.ts:3739`, `:3829`).

Class-like types stay reference types (`TypeKind.Usize`-based); `@managed` did
not introduce a new `TypeKind`, and `@inline struct` should not either, because
the *Type* must keep representing "a class-like type" for every path that
happens to touch it. What distinguishes `@inline` is not its `Type` but the
**codegen rule**: its type never reaches `Type#toRef()` (§4).

**Recommendation: a dedicated decorator flag, `InlineStruct`, on a free bit.**

- `@inline` already parses (`ast.ts:1121` → `DecoratorKind.Inline` →
  `DecoratorFlags.Inline = 1 << 6`, `program.ts:3051`), already maps to AS100 on
  a struct as the *intended* reservation (`program.ts:2101-2107` reports
  `Not_implemented_0`, "value types (@inline struct)"), and `@inline` is already
  in the allowed decorator set for structs (`program.ts:2115-2124`). So the
  syntax is in place; only the meaning is missing.
- Reusing `Inline` itself as the kind marker is possible but muddles two
  meanings (always-inline functions, and value-type records) in one bit; the
  `@managed` precedent is a distinct bit.
- **Bit 11 is occupied twice**: `ManagedStruct = 1 << 11` (`:3054`) and
  `Unsafe = 1 << 11` (`:3064`). Nine `checkUnsafe` call sites sit behind
  decorator tests (`compiler.ts:5897, 5929, 5958, 6467, 6633, 8173, 9676, 9704`
  consult `Unsafe` directly; `:9229` gates unmanaged allocation on
  `!isManaged`), so an
  `@managed struct` also answers `hasDecorator(Unsafe)` — but all nine inspect a
  function, variable or index-signature element, never the class element that
  carries the flag, and a method's `Function` copies its *function prototype's*
  flags (`program.ts:3980`). Measured: a `@managed struct` using `new`, a method
  call, a field read, a field write and a global write compiles clean under
  `--noUnsafe`, while `load<u8>(p)` under the same flag errors — the gate works,
  and the collision is latent rather than observable. It is still a defect (two
  meanings on one bit) and it rules out bit 11 for the new flag. **Take
  `1 << 12`.**

Trade-off summary: a flag keeps every existing `Type`-level rule (isManaged,
isInternalReference, byteSize) untouched and confines the change to the places
that must consult it; a `TypeKind` would force edits in `toRef`, `size`,
`alignLog2`, `isManaged`, and Binaryen type selection — the mechanical work
`@managed` avoided, with no benefit.

---

## 4. Stack allocation — what the measurements permit

### 4.1 Why the "shadow-stack slot per local" is not available

The AS shadow stack is a **root** stack, not a value stack. The module reserves
the frame by decrementing `__stack_pointer` (measured prologue:
`global.get $~lib/memory/__stack_pointer; i32.const 8; i32.sub; global.set`), and
the collector then scans **the whole live frame**:

```ts
// std/assembly/rt/itcms.ts:167-173
function visitStack(cookie: u32): void {
  let ptr = __stack_pointer;
  while (ptr < __heap_base) {          // every usize, no type information
    __visit(load<usize>(ptr), cookie);
    ptr += sizeof<usize>();
  }
}
```

called once per collection cycle (`:207`). And `__visit` does not validate:

```ts
// std/assembly/rt/itcms.ts:322-330
export function __visit(ptr: usize, cookie: i32): void {
  if (!ptr) return;
  let obj = changetype<Object>(ptr - TOTAL_OVERHEAD);
  if (RTRACE) if (!onvisit(obj)) return;
  if (obj.color == white) { obj.makeGray(); ++visitCount; }
}
```

It subtracts the header, **loads** `obj.color`, and may **store** a new colour.
A C-layout record's bytes are scalars — a `u64` held, a float, an address-like
integer — so any word in the record can be a non-pointer. Placed in the scanned
frame, that word is dereferenced as an object header: if it is not a mapped
address, the `load` **traps**; if it is, the collector reads and may write a
byte in unrelated memory.

This is not a leak risk; it is a crash and corruption risk. The invariant the
current compiler relies on is exactly "the frame holds only valid pointers or
zero" — which is why scalars live in WASM locals and references live in the
frame.

Could the slot be placed outside the scanned region? Not with one stack pointer:
the frame is `[__stack_pointer, __heap_base)`, and any allocation the compiler
can express is a decrement of that pointer, which puts the new bytes **inside**
the scanned range. Making it safe needs either a frame map the collector can
read (a runtime + codegen change, 2.0-sized) or a second, non-scanned stack
(§4.3). `__stack_check` also bounds the frame against `__data_end`
(`locals.wat`), so the frame cannot simply be pushed below it.

### 4.2 Option A — per-field WASM locals (SROA). Recommended for the value.

Each field of a live `@inline struct` local becomes its own WASM local of the
field's scalar type, allocated through the existing `flow.addScopedLocal`
(`compiler.ts:3358`) and freed at block exit exactly as any `let` is.

- Field read/write: **1 instruction** (`local.get $f` / `local.set $f`), §5.
- Assignment `y = x`: one `local.set` per field. No memory, so no aliasing —
  the partial cell's bug cannot occur.
- Locals are not memory: the collector never sees them; no root slots needed.
- Costs: local-index pressure proportional to `fields × live copies`; no address
  exists, so anything needing a pointer (an `@external` argument, an internal
  call whose callee takes it by pointer) must materialize first.

This is what a C compiler's SROA does for small structs, and it is the only
option that requires **no new memory management**.

### 4.3 Options for a contiguous temp (only where a pointer is required)

`@external` calls need `sizeof<Foo>` contiguous bytes (§8). Two mechanisms are
available without touching the collector:

**(C) A managed box.** `__new` an object of the record's shape, store the
fields, pass the reference. Safe by construction: the collector traces the
object per its *declared* member types, and a scalar-only record is
`isPointerfree` (`program.ts:5017-5030` returns false only for
`property.type.isManaged`), so the visitor is empty. Cost: one allocation per
such call — a real cost for a feature sold as "no allocation", and an
allocation whose timing the guest did not ask for.

**(D) A static call-temp stack.** A fixed buffer placed below `__data_end`,
with a depth counter: allocate `sizeof<Foo>`, store the fields, pass, release.
`visitStack` starts at `__stack_pointer ≥ __data_end`, so a buffer below
`__data_end` is never scanned — no GC interaction at all. Alignment is by
construction (the buffer is aligned to the strongest record alignment used).
Costs: a fixed capacity that must abort on overflow, and a depth counter for
reentrancy (a host call that re-enters the guest and makes another such call
nests). The guest is single-threaded here, so the counter is sufficient.

**(D) is recommended for the MVP**: it keeps the "no allocation" claim honest,
keeps every byte out of the collector's view, and changes no ABI. (C) is the
fallback if the implementer prefers no capacity bookkeeping. Neither is literally
"on the caller's stack" in the collector's sense — that phrase is the one part of
the brief's framing the measurements do not support, and stating it precisely is
part of the scope.

---

## 5. The three copy paths

### 5.1 Assignment — `y = x`

- **SROA:** `N × local.set` (`local.get $x_f; local.set $y_f`), one per field.
- **Memory form (if a temp ever holds it):** `memory.copy(dst, src, sizeof<X>())`
  — the primitive already exists and is what `COPY_STRUCT` desugars to
  (`compiler.ts:6260`, `builtins.ts:3500-3521`).

Both are element-free copies; neither is a pointer copy. The **refuse cell** is
what happens today for `@unmanaged` (measured, `alias.wat`):

```
local.get $2      ; x (a pointer)
local.set $3      ; y  -> y and x now alias
```

That is the bug the value type exists to prevent, and the fixture that shows it is
the partial cell (§14).

### 5.2 Passing

- **Guest-internal call:** monomorphize — pass each field as its own WASM
  operand, callee reassembles into locals. No memory, no aliasing. This is a
  guest-internal calling-convention change only; no external surface moves.
  Alternative: pass a pointer to a temp (mechanism (D)), needed only if the
  callee's address of the value must be stable — and an `@inline struct` cannot
  take an address (§10.5), so this is not needed.
- **`@external` call:** materialize a temp ((D) or (C)), pass its pointer. The
  import signature is already `(param i32)` (§1.6), so nothing on the host side
  changes.

### 5.3 Capture

Capturing an `@inline struct` in a closure reuses the environment mechanism of
§1.3, but the environment is a **class**, and a struct-typed class field is a
pointer slot. Two shapes:

- **Field-wise capture (recommended):** the capture analysis already works per
  binding; capture each *field* the closure reads as its own env field. Needs no
  inline-in-heap and therefore no new layout. Semantics: the closure holds a
  **copy taken at creation**, and writes inside the closure affect only that copy
  — capture by value, which is a coherent rule for a value type and needs no
  write-back. If that rule is unwanted, the alternative is to refuse writes to a
  captured `@inline struct` with a named diagnostic; both are implementable, and
  the choice should be ratified before code.
- **Heap box:** capture a pointer to a managed copy — this is `@managed`
  semantics wearing an `@inline` spelling, and it silently reintroduces aliasing
  between the closure and nothing else; it buys nothing the field-wise copy does
  not.

---

## 6. Field-access codegen (measured analogues)

`@unmanaged` and `@managed` records, both at `-O0` and `-O3` (`fieldacc.wat`,
`fa2.wat`, `ma-O3.wat`):

| Case | `-O0` | `-O3` |
|---|---|---|
| `@unmanaged` read `p.y` (offset 8) | `local.get $p; call P#get:y` | `local.get $p; i64.load offset=8` — **2** |
| `@unmanaged` write `p.x = v` | `local.get $p; local.get $v; call P#set:x` | `local.get $p; local.get $v; i32.store` — **3** |
| `@managed` read `m.y` | frame prologue + root slot + `call Man#get:y` | `local.get $m; i64.load offset=8` — **2**, plus the rooting prologue the reference requires |
| **`@inline` (SROA, proposed)** | `local.get $f` — **1** | `local.get $f` — **1** |

The SROA form is *cheaper* than either record today, because there is no pointer
to chase. That is worth saying in the release note: `@inline struct` is not a
performance pessimization, it is the one form with no indirection.

---

## 7. Alignment — what is actually wrong

**Answer: the `alignof` builtin was wrong (live, fixed in PR #9). The layout loop
is correct for the pointer model and must not be changed.**

Measured before the fix (the "refuse" cell of `interop/alignof-records`):

| Type | `alignof` | true (log2) | |
|---|---|---|---|
| `{u16}` | 2 | 1 | wrong |
| `{u32, u64}` | 2 | 3 | wrong |
| `{f64}` | 2 | 3 | wrong |
| `{u8, u32, u8}` | 2 | 2 | right by coincidence |
| `{u32, u64}` `@managed` | 2 | 3 | wrong |
| `u8` / `u16` / `u32` / `u64` / `f64` | 0 / 1 / 2 / 3 / 3 | same | correct |

Mechanism: `Type#alignLog2` is `31 - clz(byteSize)` (`types.ts:224-227`), and a
record's *Type* is class-like, so `byteSize` is the 4-byte `usize`.
`builtin_alignof` returns `type.alignLog2` with no record branch
(`builtins.ts:1311`), while `builtin_sizeof` has exactly that branch for
`Unmanaged | ManagedStruct` (`builtins.ts:1274-1283`). The record's true
alignment is already computed and stored — `Class.alignLog2`, "the strongest of
its fields', base included" (`program.ts:4556-4557`).

### 7.1 The correction: nested records are **not** mislaid

This scoping originally claimed the same `Type#alignLog2` fed the layout loop, so
that a nested record was laid out wrongly **today** — `{a: u8; b: {x: u64}}` at
`offsetof(b) == 4` / `sizeof == 8`, where "C requires 8 and 16". **That claim was
wrong**, and it is withdrawn here with the measurement that refutes it.

A record-typed *field* is a pointer: 4 bytes, aligned 4. Measured:

```
@unmanaged struct B { x: u64 }                 sizeof<B>()  = 8
@unmanaged struct A { a: u8; b: B }            sizeA = 8   offA = 0   offB = 4
@unmanaged struct APtr { a: u8; b: usize }     sizeAPtr = 8           offBPtr = 4
```

`A` and `APtr` are **byte-identical**. That is correct for C's
`struct { uint8_t a; struct B *b; }` — what the guest actually has. C's 8/16
belongs to `struct { uint8_t a; struct B b; }`, the *inline* case, which no guest
declaration can express today. The scoping applied C's inline rule to a pointer
field.

So `fieldType.alignLog2` returning 2 for a record-typed field is not a bug: 2 is
exactly the alignment of the 4-byte pointer that field stores, and the loop
(`resolver.ts:3760-3762`) places it correctly. Changing the loop to use the
record's own alignment would over-align every record-typed pointer and **move
existing offsets** — it would break the pointer model, not fix it.

### 7.2 When a branch will be needed (not now)

An `@inline struct` field stores the value inline, so its alignment is the
record's, not a pointer's. That is a new branch keyed on the inline kind:

```ts
let alignLog2 = isInlineStructField(fieldType)
  ? classReference.alignLog2   // inline storage: the value's own alignment
  : fieldType.alignLog2;       // today: a pointer, align 4
```

By construction it moves nothing today, because no type can express an inline
field yet. It belongs with the `@inline` implementation, together with the
fixture that proves existing offsets did not move — not with the `alignof` fix.

### 7.3 What was left to fix: the builtin (**fixed in PR #9**)

`builtin_alignof` must report `Class.alignLog2` (`program.ts:4556`) for
`@unmanaged` **and** `@managed` structs, exactly as `builtin_sizeof` reports
`Class.nextMemoryOffset` for the same two kinds (`builtins.ts:1274-1283`). A
class with no record decorator keeps the current answer (a 4-byte reference,
align log2 2), which is correct: the class *object* has a header, and the
*reference* is what `alignof<C>()` describes, matching `sizeof<C>() == 4`.


## 8. Calling convention at `@external`

```
@external("host", "call_foo")
declare function host_call_foo(p: Foo): void;   // Foo is @inline

// emitted: build the temp, then call with one i32
host_call_foo(x)  →  temp = <D or C slot>; store fields; call host_call_foo(temp)
```

- The import is `(param i32)` — measured for both existing record kinds (§1.6),
  and the temp's address is the same `uint32_t` a guest pointer already is
  (`tension_adapter.h:45`).
- The host must not retain the pointer; the adapter already promises never to
  cache a pointer into guest memory (`tension_adapter.h:57`), so the synchronous
  contract is the existing one, not a new one.
- **No ABI change, no hash move, no adapter rebuild.** The vtable is
  `TENSION_ADAPTER_ABI_VERSION 3u` (`:78`) and nothing in it is touched; the
  import list and its signature are unchanged, so no hash is recomputed (and
  `layout_hash` does not fold guest-side anything — §13).

This is the payoff of the WASM observation in the brief: WASM has no
struct-by-value ABI at all, so the temp is a *compilation detail*, not an ABI
surface. The scope should say that plainly, because it is what keeps the phase
small.

---

## 9. Return values — the case that sizes the phase

- **Internal return** (`function make(): Foo` inside the guest): a hidden
  destination pointer (sret). The caller allocates the destination — a temp slot
  by (D) or (C) — and passes its address as an implicit first operand; the callee
  stores its result there and returns nothing (or returns the pointer). This is a
  guest-internal convention; no external surface moves. **In.**
- **`@external` return** (`declare function host_make(): Foo`): the host would
  have to write `sizeof<Foo>` bytes into guest memory and return an address of
  them. It cannot — the only memory it may touch is what it is handed, and a
  return slot would be a new import parameter, i.e. an **ABI change** for every
  such import. So **out**, refused with a named diagnostic that says why (a host
  function cannot construct a guest value). The alternative — the host returns a
  borrowed pointer it allocated — is `@unmanaged struct`'s job, not this
  feature's.

That split is the sizing answer the brief asked for: internal returns cost an
sret convention; external returns would cost an ABI version. Scoping the latter
out is what keeps this a 1.0 feature.

---

## 10. Type interactions — in/out, each with the reason

| Interaction | In/out | Reason |
|---|---|---|
| `@inline struct` local, field read/write | **in** | SROA; 1 instruction (§6). |
| Assignment `y = x` | **in** | `N × local.set`; no aliasing (§5.1). |
| Guest-internal parameter | **in** | Per-field operands (§5.2). |
| `@external` parameter | **in** | Temp pointer; import stays `(param i32)` (§8). |
| Capture in a closure | **in** | Field-wise capture into the env class (§5.3) — with the capture-by-value rule ratified. |
| Internal return | **in** | sret (§9). |
| `@external` return | **out** | Needs an ABI change (§9). |
| Nested `@inline struct` field | **out** | Needs inline-in-record layout, and inherits the §7 defect. Rule in §10.1. |
| `@inline struct` field inside `@unmanaged struct` | **out** | C inline nesting; same layout dependency, plus a C-layout record whose field is a value — the `offsetof`/`sizeof` loop would have to place an extent, not a pointer. |
| `T[N]` of `@inline struct` | **out** | Element construction + fill; `makeZero` has no element path (§16.5). |
| `T[N]` inside `@inline struct`, literal `N` | **out** | SROA would need `N` scalars **and** a fill path; `makeZero` has no `TypeKind.FixedArray` case (`compiler.ts:10740-10777`, `default: assert(false)` at `:10743`), so a zeroed record with an array field cannot be built. Alignment is *not* the blocker: arrays already align by `fixedAlignLog2` (`resolver.ts:3753-3761`). Deferred with the nesting work. |
| `T[N]` inside `@inline struct`, non-literal `N` | **out permanently** | WASM locals are fixed-size at compile time (§2). |
| `Array<@inline struct>` | **out — question reported** | An `Array<T>` holds elements at `elementType` stride and hands out references; storing values would be inline-in-heap. The question to answer before scoping: is `Array<@inline struct>` a *sequence of copies* (elements inlined, index reads copy out) or is it refused in favour of `T[N]`? Not answered here. |
| `@inline struct` as a class field | **out** | Pointer-sized slot; inline-in-heap = the nesting case. |
| `ref`/`out`/`in`, `stackalloc`, `Span<T>`, `ref struct` | **out** | Separate features (§2). |
| `@abi.alias` on fields | **in, unverified** | The mechanism is field-level and ungated: `builtin_abiNameOf` looks the field up on the class and reads the field type node's attributes (`builtins.ts:1397-1450`) — no `Unmanaged`/`ManagedStruct` test anywhere on that path. So it *should* work by construction. It cannot be measured until `@inline struct` compiles; the 0.8.1 gap was in the *parser* accepting post-type attributes on a struct field, and 0.9.0 fixed that for `@managed` — the same parse path serves `@inline`. **The implementation phase must include the assertion** (that was PR 8's lesson). |
| `changetype<@inline struct Foo>(ptr)` | **refuse** | See §10.5. |

### 10.1 The nesting rule (design only)

Refuse, do not pointer. Two reasons: a pointer would make the inner value
aliased and defeat the value semantics the outer record promises; and the layout
that inline nesting needs (`offset += sizeof<Inner>` at `Inner`'s alignment) is
exactly what §7 shows to be wrong today, so permitting it before the fix would
ship C-incompatible records silently. Diagnostic: a named refusal at the field
declaration, in the shape `@managed` uses for inheritance
(`program.ts:2160-2173`).

### 10.4 `Array<@inline struct>` — the shape question

`Array<T>` is a managed object whose payload is `length × stride` with
`elementType`'s alignment (`compiler.ts:9007`, `__newArray(length, alignLog2,
classId)`), and its `[]` returns a *reference* to an element. An `@inline
struct` element would have to be stored inline (the array's buffer is a heap
extent) and every read would copy out — meaning `a[i].x = 1` cannot compile as
written (it would write to a temporary). So the question before scoping is:
"does `Array<@inline struct>` mean an inline buffer with copy-out reads, or is it
refused with a pointer to `T[N]`?" Not answered here.

### 10.5 `changetype` — refuse

`changetype<@inline struct Foo>(ptr)` would mean "view these bytes as a Foo",
which is precisely `@unmanaged struct`'s job and precisely the aliasing a value
type exists to avoid: the result would have identity with the memory, so
assignment would have to copy from a borrowed pointer while field writes would
mutate someone else's bytes. Refuse with a named diagnostic that names
`@unmanaged struct` as the intended tool. This also protects the invariant in
§12.

---

## 11. What a "no" would look like — and why it does not apply

| Forcing condition | Measured verdict |
|---|---|
| Copy paths need a fundamental codegen change | No: SROA is `local.set`; the memory form is `memory.copy`, which exists (`builtins.ts:3500`). |
| The `alignof` fix is large | No: ~8 lines mirroring `sizeof`'s existing record branch (§7). The layout loop is not part of it. |
| The return convention is ambiguous or needs an ABI change | Internal: sret, resolved. External: out, and deferring it removes the only ABI pressure (§9). |
| The type-kind representation conflicts with `isManaged` / `isInternalReference` / `byteSize` | No: a decorator flag leaves every `Type` rule untouched; `@managed` proved the shape (§3). |
| **A value cannot be stored anywhere safe** | **This was the real risk, and it is the finding:** the shadow stack is GC-scanned without bounds checks (§4.1). It forces SROA + a non-scanned temp, but it does not force a no. |

---

## 12. The invariant the implementation must enforce

**An `@inline struct` type never reaches `Type#toRef()`.** That is the mechanism
that makes the rest safe: `toRef` has no value representation and asserts
(`types.ts:746-749`), so any path that would need one is a compile-time failure
rather than a silent pointer. Every site that can see the type — local
declaration, parameter, return, field, array element, `changetype` — must either
handle it explicitly or refuse it by name.

Put positively, as a rule to code against: *the only places an `@inline struct`
value exists are WASM locals, and the only place its bytes exist is a temp built
immediately before an external call.*

---

## 13. Version boundary — confirmed

- **Compiler release (TensionScript 1.0).** Nothing here is consumable by the
  engine; it is guest-side semantics.
- **Zero ABI change.** The `@external` import keeps `(param i32)` (measured for
  both existing record kinds, §1.6); no vtable entry moves
  (`tension_adapter.h:78`, v3).
- **Zero hash move.** `arena.rs::layout_hash()` folds host constants and nothing
  else — region count, descriptor size, manifest entry size, type count, the
  header offsets, the region table, the type catalogue, **each host type's field
  names and offsets**, the mode/state/fault constants, the ring and event sizes
  and the default capacities (`arena.rs:1030-1104`). No guest type participates,
  so a TensionScript release cannot move it. Tension `origin/main` reports
  `786288195` (§Appendix).
- **No adapter rebuild.** Nothing in `tension_adapter.h` is touched.

---

## 14. Three-way fixture shape

Run against a guest, two independent observations per cell: the value's
behaviour, and the emitted code.

- **Refuse (before).** `@inline struct` locals are pointers — indistinguishable
  from `@unmanaged struct`, so value semantics do not hold. **Measured today**
  with `@unmanaged` (`alias.wat`): `y = x` emits `local.get; local.set` and a
  write through `y` is visible through `x`. The fixture asserts the aliasing and
  the absence of any `memory.copy`.
- **Partial.** Stack/SROA allocation works, copy-on-assignment is missing: `x`
  and `y` occupy separate slots, but `y = x` binds the slot rather than copying
  the fields (or the compiler reuses the same scoped local). The assertion is
  that mutating `y.x` changes `x.x` — the aliasing bug with the allocation in
  place. This is what ships if only allocation is done.
- **Fixed.** Allocation **and** all three copy paths — assignment, pass, capture
  — with a distinct assertion each: `y = x; y.x = 9; assert(x.x == old)`;
  `f(x); x.x = 9; assert(callee saw old)`; `let c = () => x.x; x.x = 9;
  assert(c() == old)`.

Three paths, three cells each — the paths are independent codegen sites, so one
green cell must not be taken as evidence for another.

---

## 15. Deferred items, each with its reason

- **Inline nesting** — needs inline-in-record layout; blocked on §7's layout fix
  (§10.1 gives the refuse rule).
- **`T[N]` of `@inline struct`** — element construction and per-element
  alignment; blocked on §7.
- **`T[N]` in `@inline struct` with non-literal `N`** — **permanent**; WASM
  locals are fixed-size at compile time.
- **`Array<@inline struct>`** — shape question open (§10.4): inline buffer with
  copy-out, or refuse.
- **`@inline struct` as a class field** — pointer slot; inline-in-heap is the
  nesting case.
- **`ref` / `out` / `in`** — parameter-passing feature, orthogonal.
- **`stackalloc`** — a stack pointer type with an unsafe surface; different
  feature.
- **`Span<T>` / `ref struct`** — depend on `stackalloc`.
- **By-value ABI beyond the temp** — WASM has no struct-by-value ABI; a temp
  pointer is the complete story (§8).
- **`@abi.transfer`** — still needs a host-retention use case (filed since 0.8.x).
- **`@inline struct` returned by `@external`** — would need an ABI version (§9).

---

## 16. Follow-ups

### Fixed

1. **`alignof` for records (the builtin). — FIXED in PR #9.** `builtins.ts:1311` must consult
   `Class.alignLog2` (`program.ts:4556`) exactly as `sizeof` consults
   `nextMemoryOffset` (`builtins.ts:1274-1283`) — for `@unmanaged` **and**
   `@managed` structs. Measured symptom: every multi-alignment record reports 2
   (`alignof<{u16}> == 2`, `alignof<{u32,u64}> == 2`, `alignof<{f64}> == 2`).
   **Live**, not latent: the number is wrong for every record that is not
   4-byte aligned. Prerequisite for `@inline struct` stack-slot alignment. The
   layout loop is **not** part of this item — see §7.1.
   *Fixed in PR #9*: the branch now reads `Class#alignLog2` for both kinds;
   scalars and non-record classes are unchanged. Fixture
   `tests/compiler/interop/alignof-records.ts` (three-way: refuse, partial,
   fixed). One existing assertion that had pinned the wrong value
   (`interop/sizeof.ts`) was corrected in the same PR.
2. **`DecoratorFlags.ManagedStruct` and `Unsafe` share bit 11. — FIXED in PR #9.**
   (`program.ts:3054`, `:3064`), so an `@managed struct` also answers
   `hasDecorator(Unsafe)` at eight of the nine `checkUnsafe` sites
   (`compiler.ts:5897/5929/5958/6467/6633/8173/9676/9704`; the ninth, `:9229`,
   gates unmanaged allocation on `!isManaged`). **Latent**: all nine inspect a
   function, variable or index-signature (or, at `:9229`, a class that is *not*
   managed), and a method's
   `Function` copies its function prototype's flags (`program.ts:3980`), so the
   class-level bit does not reach them — measured, a `@managed struct` with
   `new`, a method call, a field read, a field write and a global write compiles
   clean under `--noUnsafe`, while `load<u8>(p)` under the same flag errors.
   Still a real defect (two meanings on one bit).
   *Fixed in PR #9*: `Unsafe` moved to `1 << 13`, `ManagedStruct` stayed at
   `1 << 11`, and `InlineStruct` is reserved at `1 << 12` (declared only; no
   code path reads it). Fixture
   `tests/compiler/interop/managed-struct-unsafe-flag.ts` is a regression guard
   (the collision was latent, so it could not distinguish the old bit); the
   control that the gate still fires is `tests/compiler/unsafe.ts`.

### Open

3. **`build.rs` warning text (Tension PR 33).** The Zig and gfortran warnings
   still tell the user to "set TENSION_ALLOW_UNPINNED=1", which is inert now that
   both floors warn-and-continue; the variable only silences the warning. Drop
   the clause in the next `build.rs` touch. (Carried from PR 33's report.)
4. **Fixture-gated test harness (Tension PR 33).** 17 tests fail strictly on
   missing OGRE/async fixtures, 22 skip messages across 13 suites. Test-harness
   debt; not touched here.
5. **`Type#toRef()` has no `FixedArray` case** (`types.ts:746-749`), so any
   fixed-array *local* crashes the compiler with an assertion rather than a
   diagnostic. Adjacent to this phase (SROA will make aggregate locals common)
   and worth a named refusal even after `@inline struct` lands.
6. **`makeZero` has no `TypeKind.FixedArray` case** (`compiler.ts:10740-10777`;
   the switch's `default: assert(false)` is at `:10743`). This is the "makeZero
   bug" filed by the 0.9.0 phase; note the line moved — that phase cited
   `10688`, which on `277eebaf` resolves to `addDebugLocation`, an unrelated
   method. The site is `10740`.

7. **`T[N]` of a record** (e.g. `arr: B[2]` where `B` is a struct) is accepted and
   composes as **N four-byte references**, not N inline records:
   `sizeof<B>() == 8` but `sizeof<B[2]>() == 8` and `alignof<B[2]>() == 2`, so
   `A { a: u8; arr: B[2] }` measures `sizeA == 12` / `offArr == 4`. The shape
   cannot be indexed — `TS2329: Index signature is missing in type 'B[2]'` — so
   it is declarable but unusable. Cause: the element check is
   `elementType.isMemory` (`resolver.ts:487`), not "must be a value type", so a
   record element passes. **Deferred with the `@inline` design**, because the
   semantic choice — array of references vs array of inline values — is the same
   question `@inline struct` answers, and changing it would alter `sizeof` for a
   shape that already exists. No record in the engine tree declares one
   (read-only grep, Tension `5fdb63b`).

---

## 17. Recommendation

**Proceed with the minimum viable form, in this order:**

1. ~~Land the `alignof` fix~~ — **done in PR #9**. Do **not** touch the layout
   loop: it is correct for the pointer model (§7.1); the inline-field branch
   arrives with the feature that needs it (§7.2).
2. ~~Resolve the flag bit~~ — **done in PR #9** (`InlineStruct = 1 << 12`
   reserved). What remains is to add the kind and the resolver gate (§3).
3. Implement SROA locals + the three copy paths (§4.2, §5) with the three-way
   fixture of §14 — the partial cell is the one to write first, because it is the
   bug the feature exists to remove.
4. Add the `@external` temp (§8) with mechanism (D), and the internal sret
   convention (§9).
5. Refuse `@external` returns, `changetype`, nesting, `T[N]` and `Array` by name
   (§9, §10), so the boundaries are compile-time errors rather than later
   surprises.
6. Verify `@abi.alias` on the new kind as part of the change — the mechanism is
   ungated but unproven until the type exists (§10).

**Do not** attempt the shadow-stack slot for the value. It is the one design that
the collector's own code forbids.

---

## 18. What could not be measured read-only

- **`@inline struct` itself** — not implemented; every claim about its codegen is
  a proposal derived from the measured behaviour of `@unmanaged`/`@managed`, not
  an observation of `@inline`.
- **`@abi.alias` on `@inline struct`** — the path is ungated by inspection
  (§10), but it cannot be compiled until the kind exists.
- **`memory.copy` for a value assignment** — the primitive exists and is used by
  `COPY_STRUCT`, but no `@inline` assignment exists to emit it.
- **The temp's cost** — allocation count for (C), capacity for (D). Neither can
  be measured before the codegen exists.
- **Anything host-side** — this scoping makes no engine change; the one
  cross-reference (`tension_adapter.h`) was read, not exercised.
- **`Array<@inline struct>`** — deliberately unanswered (§10.4).
- The local checkout is at 0.8.1 (§1.1), so greps of the working tree do not see
  0.9.0; all citations name `origin/main`.

---

## Appendix — probes and citations

Probes (all in `/tmp/inline-probe/`, compiled with the published 0.9.0):

| File | What it measured |
|---|---|
| `locals.wat` | Locals: scalar, class ref, `@unmanaged`, `@managed`, `u64`; frame prologue; `__stack_check`; `__stack_pointer` = 33212 = `__heap_base`, `__data_end` = 444. |
| `capture.wat` | Env class allocation (`__new`), one-store capture, `$Env#set:x`. |
| `sizes.wasm` | `alignof` (scalars and records), `sizeof`/`offsetof` for records. |
| `hostbound.wat` | Import signatures `(param i32)`; `@managed`/`@unmanaged` pass with no copy. |
| `fieldacc.wat`, `fa2.wat`, `ma-O3.wat` | Field access instruction counts at `-O0`/`-O3`. |
| `alias.wat` | `@unmanaged` assignment copies the pointer (the refuse cell). |
| `nested.wasm` | The nested-record layout: `offsetof("b") = 4`, `sizeof = 8`, `alignof<Inner> = 2`. |
| `arraylocal.ts` | Fixed-array local → `AssertionError` at `Type#toRef` (`types.ts:748`), from `compiler.ts:8066`. |

Source citations (TensionScript `origin/main` @ `277eebaf`):

- Locals: `compiler.ts:3358`, `:3372`, `:8066`.
- Fixed-array local crash: `types.ts:746-749`.
- Closure env: `closure/lower.ts:2118`, `:2142`; measured `__new` in `capture.wat`.
- `alignof`: `builtins.ts:1311`; `sizeof`'s record branch `:1274-1283`;
  `Type#alignLog2` `types.ts:224-227`; `Class.alignLog2` `program.ts:4556-4557`;
  layout loop `resolver.ts:3760-3762`.
- `@managed` precedent: `program.ts:3054`, `parser.ts:413`, `:2109-2132`.
- `@inline` reservation: `program.ts:2101-2107`, `:2115-2124`; `ast.ts:1121`.
- Flag collision: `program.ts:3054`, `:3064`; uses at `compiler.ts:5897/5929/5958/6467/6633`.
- `abiNameOf`: `builtins.ts:1397-1450`.
- Collector: `std/assembly/rt/itcms.ts:155-173`, `:207`, `:322-330`;
  `program.ts:5017-5030` (`isPointerfree`).
- `COPY_STRUCT` / `memory.copy`: `compiler.ts:6258-6290`, `builtins.ts:3500-3521`.
- Tension (read only, `5fdb63b`): `tension-core/include/tension_adapter.h:45`,
  `:57`, `:78`; `tension-core/src/session/arena.rs:1030-1104` (`layout_hash`,
  host constants and field names only), host reports `786288195`.
