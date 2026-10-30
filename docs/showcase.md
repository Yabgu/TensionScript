# Feature showcase

One section per capability: what it is, a runnable example, the semantics that
matter, and the forms that are refused. Every example in this document **compiles
on the commit that added it** — each was run through `tensionscript` and the
result is recorded in that commit's message. Examples that do not yet compile are
marked **pending** with the phase that will land them, and are not written as if
they work.

Version this describes: **0.10.0**. Base: `origin/main` after PR #31.

---

## 1. C-model interop

A record whose bytes the host can read is declared with `@unmanaged struct`. The
layout is C's: fields at their natural alignment, `sizeof` including trailing
padding, `offsetof` reporting the field's byte offset. `@abi.alias` gives a field
the *C* name it has on the wire while keeping the TensionScript name, and
`abiNameOf` reads that name back.

**Storage is explicit at every declaration.** A bare `struct` is a *value* — the
bytes live in the variable, with copy-on-assignment and no address — so a record
the host reaches through a pointer says `@unmanaged`, and a GC-owned record says
`@managed`. `@inline struct` is the same declaration as a bare `struct` and exists
as a synonym for code that reads better saying so.

```ts
@unmanaged struct Vertex {
  @abi.alias("px") x: f32;
  @abi.alias("py") y: f32;
  @abi.alias("pz") z: f32;
  tag: u8;
  @abi.alias("flags") version: u32;
}

export function sizeofVertex(): i32 { return sizeof<Vertex>(); }
export function offsetOfTag(): i32 { return offsetof<Vertex>("tag"); }
export function offsetOfVersion(): i32 { return offsetof<Vertex>("version"); }
export function cNameOfX(): string { return abiNameOf<Vertex>("x"); }
```

Compiled: `sizeof` **20**, `offsetof("tag")` **12**, `offsetof("version")` **16**.
The 20 is the C answer, not the sum of the fields: `12 + 1` leaves three bytes of
padding before a `u32` at 16, and the record ends at 20.

Semantics worth knowing:

- **`sizeof` is the C size, trailing padding included.** This is what makes a
  record describable by a C header rather than approximately describable.
- **`@abi.alias` is a naming layer, not a storage change.** The field keeps its
  TensionScript name for source, and the alias is what the binding generator and
  `abiNameOf` report.
- **`layout_hash` is the engine's, not this compiler's.** The engine computes a
  hash over arena geometry and a guest declares the shape it was compiled
  against; drift is caught when a session opens. TensionScript's contribution is
  that record layout is *deterministic and C-shaped*, which is the property that
  makes a hash check meaningful. Nothing in this repository computes the hash —
  verified: it appears only in comments here.

Refused / limitations:

- **A `@unmanaged`-typed field is a reference, not inline.** `@unmanaged struct
  Outer { tag: u8; inner: Inner; }` with a 16-byte `@unmanaged Inner` is **8**
  bytes (`1 + 3 pad + 4 pointer`), measured.
- **A plain-struct-typed field is inline**, since the default flip: the same
  `Outer` with a plain 16-byte `Inner` is **20** bytes (`1 + 3 pad + 16`),
  measured. The two spellings differ in the *field*, not the outer — which is why
  storage is always written down at the field that matters. Inline nesting of an
  `@inline` value inside an **`@inline`** value is still deferred (see §9).
- `T[N]` of a *scalar* does inline (`u8[3]` is three bytes); `T[N]` of a record
  is deferred.

---

## 2. `@managed struct`

The same C layout, but GC-owned: `new` allocates it, the collector traces it, and
the **reference is the fields pointer** — a field read is a load from the
reference, with no header indirection in the emitted code. That is what lets a
host read the record through the pointer it is given.

```ts
@managed struct Particle {
  x: f32;
  y: f32;
  mass: f32;
  id: u32;
}

export function spawnAt(x: f32, y: f32, m: f32, id: u32): Particle {
  let p = new Particle();
  p.x = x; p.y = y; p.mass = m; p.id = id;
  return p;
}

export function totalMass(ps: Particle[]): f32 {
  let sum: f32 = 0;
  for (let i = 0; i < ps.length; ++i) sum += ps[i].mass;
  return sum;
}
```

Compiled: `sizeof<Particle>()` **16**, `offsetof("mass")` **8**, and the accessor
is `f32.load offset=8` from the reference itself.

Semantics:

- **The reference *is* the fields pointer.** A `Particle` crossed to the host is a
  pointer to `x`; the engine reads fields at their `offsetof` values.
- **`sizeof` and `offsetof` describe the fields, not the object header.** The
  header is the allocator's business and is not part of the C view.
- **The host must not retain the pointer past the call.** The record is
  GC-owned: a pointer held across a collection is a dangling reference. This is
  the engine's adapter rule, and it is the price of not copying.

Refused / limitations:

- A `@managed struct` cannot be used where an `@unmanaged` one is required
  without a conversion; see §4's refused cells.

---

## 3. `@inline struct` — value types

A record can be a **value**: bytes in locals, copied on assignment, passed by
value, returned by value. This is the type to reach for when a record is
arithmetic rather than an object.

```ts
@inline struct Vec3 { x: f32; y: f32; z: f32; }

function add(a: Vec3, b: Vec3): Vec3 {
  let r = new Vec3();
  r.x = a.x + b.x; r.y = a.y + b.y; r.z = a.z + b.z;
  return r;                       // sret: a hidden destination parameter
}

function dot(a: Vec3, b: Vec3): f32 {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
  let l = dot(v, v);
  if (l == 0) return v;
  let inv: f32 = 1.0 / sqrt<f32>(l);
  let r = new Vec3();
  r.x = v.x * inv; r.y = v.y * inv; r.z = v.z * inv;
  return r;
}

export function demo(): f32 {
  let a = new Vec3(); a.x = 3; a.y = 4; a.z = 0;
  let b = new Vec3(); b.x = 1; b.y = 2; b.z = 2;
  let s = add(a, b);              // a local: an sret result has no address to pass
  let n = normalize(s);
  return dot(n, n);               // 1.0
}

export function copyOnAssignment(): f32 {
  let a = new Vec3(); a.x = 1; a.y = 2; a.z = 3;
  let b = a;                      // a copy, not an alias
  b.x = 99;
  return a.x;                     // 1
}
```

Compiled and **run**: `demo() = 0.99999988` (a unit vector, float rounding),
`copyOnAssignment() = 1`.

Semantics:

- **SROA.** A local of this type has one WASM local per field, not one local and
  an address. That is why a whole value cannot be read as a value: there is no
  address to read from.
- **Copy on assignment, by value at calls, sret on return.** All four positions
  are implemented: SROA locals, flattened parameters, sret returns, and an
  `@external` argument temp.
- **Assigning does not alias.** `let b = a` copies; mutating `b` cannot be seen
  through `a` — asserted above rather than asserted in prose.

Refused / limitations:

- **A single-field record is refused at every boundary.** The C/WASM tool
  convention passes a one-scalar struct as the scalar itself while this compiler
  passes a pointer; both are `(param i32)`, so the disagreement would be silent.
  The refusal is the honest answer (`BasicCABI` divergence, ratified).
- **A return across the module boundary is refused** —
  `AS100: an @inline struct return across the module boundary` — because the host
  would have to pass a destination pointer. In-module sret works.
- **A whole value in a value position** (`let n: u32 = p`) is refused: no local to
  read, no address to take.
- **An `@inline struct` argument must be a local.** `dot(add(a, b), add(a, b))` is
  refused — `AS100: passing this expression as an @inline struct argument (only a
  local value can be passed)` — because a value has no address, so an expression
  result has nothing to hand over. Assign to a local first, as `demo` does.
- **Fields that are `T[N]` or GC references** are refused in this phase (§9).

---

## 4. Memory-model overrides

A *use* can name the model it wants while the declaration keeps its own. The
template decides storage; the use decides how this one value crosses.

```ts
@unmanaged struct Vec3 { x: f32; y: f32; z: f32; }

// 1. @inline at the use: copied into locals for this call only.
function dotInline(a: @inline Vec3, b: @inline Vec3): f32 {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// 2. The free cell: @managed over a pointer declaration roots the operand.
@managed struct Body { pos: Vec3 = {}; mass: f32 = 1; }

// 3. @unmanaged at the host boundary: the host passes the fields pointer.
@external("env", "host_read")
declare function hostRead(p: @unmanaged Vec3): void;

export function demo(): f32 {
  let a = new Vec3(); a.x = 1; a.y = 2; a.z = 3;
  let b = new Vec3(); b.x = 4; b.y = 5; b.z = 6;
  let d = dotInline(a, b);          // 32, by value
  let body = new Body();
  body.pos = a;
  hostRead(body.pos);               // the pointer crosses
  return d + body.pos.x;
}
```

Semantics:

- **Pre-type placement.** `v: @inline Vec3` — the decorator precedes the type it
  applies to. A post-type spelling is refused (`TS6392`), because it would be
  silently ignored.
- **The free cell is implicit.** `@managed` ↔ `@unmanaged` needs no ceremony;
  the operand is rooted across the call.
- **The two boundary cells** are `@inline` over a pointer declaration: an import
  temp copy and an export byval prologue.

Refused by principle — a use cannot confer what the value does not have. **This
block does not compile, on purpose**; the three diagnostics below it are what it
produces:

```ts
@unmanaged struct U { x: f32; }
@inline struct V { x: f32; y: f32; }

export function r1(u: @managed U): f32 { return u.x; }   // TS6394
export function r2(v: @unmanaged V): f32 { return v.x; } // TS6395
export function r3(v: @managed V): f32 { return v.x; }   // TS6395
```

```
TS6394: Type 'U' has no GC header, so a use cannot make it '@managed'
TS6395: Type 'V' is a value with no address, so a use cannot view it as '@unmanaged'
TS6395: Type 'V' is a value with no address, so a use cannot view it as '@managed'
```

The two reasons are different and both structural: provenance (an `@unmanaged`
record has no GC header to trace, and a use cannot invent one) and no-address (an
`@inline` value lives in locals, so there is nothing to lend as a pointer).

The one cell where the use *does* supply an address is
`changetype<@unmanaged T>(ptr)` with `T` inline-typed; the result is a
call-scoped view over those bytes. Field access on the view is the Phase 1 form;
the function-parameter form lands in Phase 2.

---

## 5. Async/await

`await` is the marker — there is no `async` keyword to write on the await itself.
A call to an `async function` produces a `Task<T>`; awaiting it parks the current
task until the host resumes it. The scheduler's contract is park / wake / resume.

```ts
async function step(x: i32): i32 { return x + 1; }

export async function chain(): i32 {
  let a: i32 = await step(1);     // parks here until the host resumes
  let b: i32 = await step(a);
  return b;                       // 3
}

export function start(): Task<i32> { return chain(); }
```

Compiled: 30 KB wasm, and the emitted module imports
`(import "scheduler" "park" (func $~lib/task-rt/hostPark (param i64 i32 i32)))` —
the only scheduler import, and it appears precisely because something suspends.
Run (settled path): `chain()._record.payload` is **3**.

Semantics:

- **The task table is the guest's.** The continuation lives in guest memory, so
  the executor's table is the guest's table; `park` tells the host the id.
- **A settled await does not suspend.** Awaiting a task that has already completed
  returns immediately — no park is registered, so the continuation cannot run
  twice.
- **The push path is the shipped path.** Completions are delivered by the host;
  the older pull path (`__taskDeliver` / `__taskTick`, a guest-side drain the
  frame loop called) was retired in 0.7.0.

Refused / limitations:

- **A reference-typed await result is refused**:
  `AS100: Not implemented: a reference-typed await result` — measured on
  `Task<string>` and on a class reference. A reference comes from the capability's
  own reader at the await site instead.
- **There is no `Promise`, no microtask queue, and no cancellation.** A task is
  parked until delivered; the contract has no cancellation.
- **Top-level `await` is refused**, despite the diagnostic's TypeScript text
  mentioning it: TensionScript's entry point is an ordinary function.

---

## 6. Closures

A closure captures a binding by moving its storage into a synthesized environment
class. The captured binding then has **exactly one home** — the environment — and
every read goes there.

```ts
function counter(start: i32): () => i32 {
  let n = start;                  // captured: its storage moves to the env
  return (): i32 => {
    n += 1;                       // the one and only `n`
    return n;
  };
}

class Base {
  label: i32 = 41;
  makeReader(): () => i32 {
    return (): i32 => this.label + 1;   // TypeScript's `this`
  }
}

export function run(): i32 {
  let next = counter(10);
  let a = next();                  // 11
  let b = next();                  // 12 — same binding, not a fresh copy
  let r = new Base().makeReader();
  return a * 100 + b * 10 + r();   // 1262
}
```

Compiled, and the environment is visible in the emitted module as
`counter$Env#get:n` / `counter$Env#set:n`. Run: **1262**.

Semantics:

- **One home.** The local in the source becomes a field of the environment; there
  is no second copy to fall out of sync.
- **`this` in an arrow is TypeScript's rule** — the nearest enclosing non-arrow
  receiver, not the arrow's own. The receiver travels with the function value.
- **Coverage:** `tests/closure/lower.js` is 192 of 192 checks, run as part of
  `npm test`.

Refused / limitations:

- **Closure capture of an `@inline` value** is deferred: the environment is a
  class, and a value-typed field in one is inline nesting (§9).
- A captured local with no declared type and that crosses an await is refused by
  name (pre-existing rule, not closure-specific).

---

## 7. Lazy expressions

`@lazy` defers an expression's evaluation to the binding's **first read**, and
memoizes it. Three forms, differing in *when the work starts* and *when the await
happens*:

```ts
let calls: i32 = 0;
function compute(): i32 { calls += 1; return 41; }
async function fetchValue(x: i32): i32 { calls += 1; return x * 10; }

// 1. Deferred, synchronous.
export function deferredSync(): i32 {
  let a = @lazy compute();
  let first: i32 = a;          // compute() runs here
  let second: i32 = a;         // not here
  return first + second;       // 82
}

// 2. Deferred, sequential async: called and awaited at the first read.
export async function deferredAwait(): i32 {
  let b: i32 = @lazy await fetchValue(3);
  let v: i32 = b;              // runs and is awaited here
  return v;
}

// 3. Parallel + deferred await: spawn launches at the declaration.
export async function parallelDeferred(): i32 {
  let c: i32 = @lazy await spawn(fetchValue(4));
  let v: i32 = c;              // already running since the declaration
  return v;
}
```

Compiled and **run**: `deferredSync() = 82`, `payloadOf() = 30040`
(`30 * 1000 + 40`), `callCount() = 3` — each of the three initializers ran
exactly once across all reads.

| Form | when the work starts | when the await happens |
|---|---|---|
| `@lazy f()` | the first read | — (synchronous) |
| `@lazy await f()` | the first read | the first read |
| `@lazy await spawn(f)` | **the declaration** | the first read |

Semantics:

- **`spawn` is a marker, not a function.** `spawn(f(a))` is `f(a)` plus "this is a
  launch". A call to an `async` function *is* the launch, so `spawn` adds no
  runtime; it exists to escape `@lazy`'s deferral and to give the unawaited-task
  warning a subject.
- **Never read:** for `@lazy f()` and `@lazy await f()` nothing happens — the
  initializer sits inside the guard, so an unread binding never calls. For
  `@lazy await spawn(f)` the task has already launched, so it completes and its
  value is discarded (JS semantics; the scheduler has no cancellation).
- **Memoized, once.** The flag makes only the first guard body execute. The sync
  form compiles the initializer once per read *site* (there is no getter), so a
  binding read twice emits two guarded copies — visible in the emitted module, and
  the flag is what makes it correct.

Refused / limitations:

- **`@lazy await` needs a declared type** (`TS6399`). A memo cell that crosses a
  suspension becomes a state field, and a state field needs a syntactic type —
  the same rule that refuses `let v = await f();` without `@lazy`.
- **`await @lazy f()` is refused** (`TS6402`): the await performs the read
  immediately, so the deferral is nullified. The distinction is by *immediate*
  parent — `await (0 + @lazy f())` keeps the generic position error (`TS6397`).
- **`@lazy` outside a declaration initializer** is refused (`TS6397`): deferral
  needs a name for the memo cell. After a type (`let x: i32 @lazy = 5`) it is
  refused too (`TS6396`).
- **A statement-position `spawn`** warns (`TS6401`): the Task is discarded. The
  weaker case — `let t = spawn(f)` never awaited — is a filed follow-up (§9).
- **A captured `@lazy` binding** takes the eager path with a warning (`TS6398`):
  correct answer, early evaluation (§9).
- An `@inline struct` value cannot be a lazy binding (no single cell to memoize).

---

## 8. Sized enums

An enum is a storage class, and `enum Foo: T { … }` declares which one. Without
an underlying type an enum is `i32`, exactly as it always was; with one it is
that type, and everything that reads a width follows — `sizeof`, `offsetof`,
`alignof`, field offsets, `T[N]` strides, load and store widths.

```ts
enum Color: u8 { Red, Green, Blue }

@unmanaged struct Pixel {
  flags: u8;
  color: Color;
}

export function setColor(p: Pixel): void {
  p.color = Color.Blue;   // no cast: the field is u8 and the enum is u8
}

export function byteSize(): i32 { return sizeof<Color>(); }        // 1
```

Measured on this commit (the assertions live in
`tests/compiler/interop/sized-enum-layout.ts`):

- `sizeof<Color>()` is **1**, `alignof<Color>()` is **0**. A plain `enum { … }`
  is still **4** / **2** — the default did not flip.
- `sizeof<Pixel>()` is **2** and `offsetof<Pixel>("color")` is **1** (from 8 and 4
  when the enum was `i32`).
- A `Color[3]` field is 3 bytes, stride 1 — no `shl 2`. In `{ n: u8; colors:
  Color[3] }` that is `offsetof` 1, `sizeof` 4.
- `p.color = Color.Blue` needs no cast. Before this phase the same assignment
  was `AS200: Conversion from type 'i32' to 'u8' requires an explicit cast` —
  the wire-record bug class.
- A store through the field is `i32.store8`; a load is `i32.load8_u`, and
  `w.flags` in the byte before it survives.
- A `switch` on a `u8`-backed enum masks each use (`i32.and 255`) and compares
  with `i32.eq` — the shape is unchanged, because it comes from the operand's
  type.
- Nothing in the layout path learned about enums. The 55 `.byteSize` readers,
  the switch, the casts and the record accessors all needed zero changes: the
  enum *is* its `Type`, and this phase repoints the type.
  (The count reads 56 on a merged tree because `resolver.ts:458`'s doc comment
  mentions `.byteSize` in prose; the diff confirms zero *reader* changes — 53
  code occurrences on both sides of the change.)

Accepted underlying types are `i8`, `u8`, `i16`, `u16`, `i32`, `u32`. Anything
else — `bool`, `i64`, a float, a reference — is refused by name (`TS6403`).

A member that does not fit the declared width is refused at the declaration
(`TS6404`), before any codegen; that is what keeps `const enum` from inlining a
truncated value, since the inlining path *masks*. A literal out of range also
reports the existing `AS200`, because the conversion machinery refuses it first.
Measured, `enum E: u8 { A = 200 + 200 }` is `TS6404` only — a folded constant is
not a literal, and without the declaration guard it would compile silently.

One consequence to state: a sized enum and its underlying scalar are the *same*
`Type`, so `w.kind = E.A` into a `u8` field is legal. An enum does not add
nominal checking — it never did. `case 99:` is accepted for the same reason it
always was.

A wire record may adopt a sized enum only after the C-side enum width is measured
in the Tension repository: if the engine declares the corresponding enum `int`, a
`u8`-sized guest enum moves the arena's `layout_hash`. Engine-side; out of scope
here.

---

## 9. What's deferred

Each item names what blocks it. The full list, with the reason for each, is
[`roadmap.md`](roadmap.md); engine-side items are marked and live in the Tension
repository.

| Item | Why it is deferred |
|---|---|
| **Inline nesting** — an `@inline struct` as a field of another record | A field of a value type has no address of its own; the nesting needs the same no-address reasoning as §3's refusals. Measured today: a struct field is a 4-byte pointer, not inline. |
| **`T[N]` fields in `@inline struct`** | Deep SROA: N locals per array field, plus a `makeZero` arm for `FixedArray` (which asserts today). |
| **GC-reference fields in `@inline struct`** | An SROA'd field lives in a WASM local, and the write barrier's `__link` needs an **address**; the implementable options are a mixed representation or refusal. Refused for now. |
| **Closure capture of an `@inline` value** | Needs inline nesting first — the environment is a class, and a value-typed field in one is nesting. |
| **`@external` return of `@inline struct`** | An ABI version: the host would have to write `sizeof<T>` bytes into a slot it never allocated. |
| **SROA for top-level statics** | A global is one `i32` slot; a value needs one per field. Would need per-field WASM globals or a shadow slot. |
| **`lazy-await-type-inference`** | `@lazy await` requires a declared type (`TS6399`). Lifting it needs a post-resolution transform hook (none exists — `applyInTreeTransforms` is `afterParse` only) or return-type inference for calls. |
| **`w3-await-context-walk`** | The unawaited-`spawn` warning fires only where the Task is certainly discarded (statement position). `let t = spawn(f)` never awaited needs an await-context walk the transform does not have. |
| **`lazy-captured-binding-deferred`** | A captured `@lazy` binding takes the eager path with `TS6398`: correct answer, early evaluation. The deferred path needs the same post-resolution hook. |
| **`skin-record-undeclared`** *(engine)* | A 32-byte record written by offset with no declaration anywhere in the guest. Finding: `Tension/docs/session-findings.md`. |
| **`state-vector-declarations`** *(engine)* | 41 sites writing into memory that is not a record — a fixed field sequence with no declared type. Finding: `Tension/docs/session-findings.md`. |
| **`const borrow`** | **Not found in either repository.** Named in a task brief; no scoping entry, finding, or source location defines it. Listed here so the absence is recorded rather than silently dropped. |

---

## 10. Where to go next

- **[`roadmap.md`](roadmap.md)** — deferred features and durable findings, one
  line each with the reason it is not built yet, and the repository's workflow.
- **[`fork-posture.md`](fork-posture.md)** — what this fork is, what it
  deliberately shares with AssemblyScript, and the sync cadence.
- **[`scheduler-contract.md`](scheduler-contract.md)** — the async contract §5
  implements against.
- **[`async-phase1.md`](async-phase1.md)** — the phase-1 async record, kept
  because it documents the shape the later phases were built on.
- **[`../CHANGELOG.md`](../CHANGELOG.md)** — what shipped in which release.
