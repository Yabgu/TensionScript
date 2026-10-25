# `sret`: returning an `@inline struct` by value — design note

**Status:** design note. No code. Read-only on source.
**Base:** `main@f55fe7d0` (PR #14 merged: flattened signatures and the
source-to-WASM parameter mapping).
**Precedent it builds on:** `docs/interop-inline-struct-scope.md` §9 (returns
"size the phase"), §4.3 (the static call-temp stack), and
`docs/session-findings.md` (the site-list-is-not-final pattern).

---

## 0. What this note decides, and what it does not

Decides: **the shape** — where the hidden destination parameter goes, how arity
checks count it, how the mapping helper answers for it, how the destination slot
is allocated, and whether that allocation shares the mechanism the scoping
already chose for the `@external` temp.

Does not decide: whether to implement now. That is §9's recommendation.

**Not in scope, and unchanged by this note:** closure capture, `@external`
returns (which need an ABI version, not a hidden parameter — §9 of the scoping),
`T[N]` fields, GC-reference fields, inline nesting, top-level statics. All stay
refused.

---

## 1. Why sret at all

`Signature#resultRefs` is a single `toRef()` (`types.ts:1181-1183`):

```ts
get resultRefs(): TypeRef {
  return this.returnType.toRef();
}
```

`toRef()` on a record has no case — it asserts. A value has no WASM value-stack
representation, so it cannot be a result. The two shapes that could carry one
out of a call are **multi-value results** (which `module.ts:2207`'s
`results: TypeRef` does accept — a tuple) and **a hidden destination pointer**
(sret). This note takes sret, and §8 explains why multi-value does not remove the
problem.

---

## 2. The measured constraints

Each was measured in a prior turn; recorded here as the input to the design.

**(a) The hidden parameter goes first.** C's convention on the ABIs that spend an
argument slot (SysV x86-64, Win64) is the structure-return pointer as the first
argument; AAPCS64 uses a dedicated register instead, which has no WASM analogue.
And the tuple itself imposes no constraint: `module.ts:2207` takes
`params: TypeRef` — an opaque tuple — so "first" is a convention choice, not a
mechanism requirement. First it is, because it makes the destination's index a
constant (`0`, or `1` with `this`) rather than a function of the source arity.

**(b) Arity checks are source arity; the hidden parameter appears at emit.**
This is PR #14's precedent, and the alternative is **wrong, not merely
different**: the user writes `f(x)` — one source argument — while the WASM
arity is two. A check comparing `numArguments` against `wasmParamCount()` would
reject that valid call, and would accept `f(x, y)` for a one-parameter function.
So `maximum` (`compiler.ts:6630`) and the assert at `:6748` stay
`parameterTypes.length`, exactly as PR #14 left them.

**(c) `lower`/`upper` never build signatures.** `compiler.ts:1034` and `:1753`
only *scan* `parameterTypes` to set `desiresExportRuntime`; they emit no
signature. Signature construction is `paramRefs` (`:1726-1766`), which would carry
a hidden parameter if sret added one there. And an `@external` function
returning `@inline struct` is already refused by PR #12's rule, so no boundary
signature ever needs one today.

**(d) There is no hidden-parameter precedent.** `grep -n
'sret\|hiddenParam\|destParam\|retPtr' src/` → **0 hits**. sret introduces the
first parameter the source never mentions. That is why the note exists rather
than a commit.

**(e) Per-field caller locals is structurally impossible, not merely a
tradeoff.** The tempting shape — "SROA the return at the call site, so the
caller's field locals are the destination" — cannot work, and the reason is
sharper than consistency: **the callee's fields are WASM locals, and a WASM local
has no address.** The callee would have to *store* into memory to fill a
caller-provided destination, and it has nothing to store through. A variant with
N destination pointers (one per field) restores addresses but abandons the
premise: the callee's return path becomes N memory stores, and the caller must
then re-load them into locals. The value would cross the boundary as memory
either way, so the simplest form of "as memory" is one pointer to one buffer.

**(f) The destination must be memory that the collector does not scan.** This is
the constraint that decides the mechanism, and it is the same one the scoping
already resolved for the `@external` temp (§4.3, mechanism D):

- the **shadow stack is scanned** word-by-word (`std/assembly/rt/itcms.ts:167-173`,
  called per collection at `:207`), and `__visit` dereferences each word without
  a bounds check (`:322-330`). A record's bytes there are a trap or a
  corruption risk, not just a leak.
- a **static buffer below `__data_end`** is outside `[__stack_pointer,
  __heap_base)`, so it is never scanned — and the language can already express
  one: `memory.data(...)` (`std/assembly/memory.ts:78`) is used by std itself
  (`date.ts:358`, `math.ts:36`).

---

## 3. The mechanism decision: **(B) shared mechanism, sequential implementation**

sret's destination and the `@external` temp are **the same problem**: an
addressable slot, valid for the duration of one call, that the collector must not
scan. The scoping already chose the static call-temp stack for the `@external`
case (§4.3). sret should establish that stack and the `@external` temp should
reuse it.

**Why (B) rather than (A) — implement together.** sret's shape is the simpler one
to establish a stack against: exactly **one** destination per call, allocated at
the call site, reclaimed when the call returns, with no reentrancy question that
the call itself does not already answer. The `@external` temp has the harder
profile (a temp per *argument*, for a call that may re-enter the guest). Getting
the buffer and its alloc/reclaim right against the simple shape first is the
lower-risk start, and the second phase then has nothing new to design — only to
allocate from a stack that already works.

The cost of (B) over (A) is one extra PR boundary and a second review of the
same file region. The cost of (A) over (B) is designing two allocation patterns
at once, against two different lifetimes, before either has run.

**Why not (C) — a managed box per call.** Measured, at `-O3`, on a two-field
record:

```
static buffer (memory.data)      5  WAT lines    no frame, no GC
new Box() inlined __new        314  WAT lines    memory.fill + GC list linkage
                                                 + total += + threshold check
```

The 314 is the inlined `__new` body, and it is not just size: `__new` contains

```ts
// std/assembly/rt/itcms.ts:262
if (total >= threshold) interrupt();
```

so a box-per-call can trigger a **collection in the middle of a call** whose
arguments the caller is still holding. That is a correctness surface the static
stack does not have at all, not only an allocation cost. (C) is therefore not
merely more expensive — it introduces a new failure mode into the return path.

**Decision: (B).** One static call-temp stack, established by the sret PR,
with `alloc(size, align)` / `release(mark)` semantics; the `@external` temp
phase reuses it in a later PR.

---

## 4. The design

### 4.1 The signature

For a source signature `(p: P{2}, q: i32) -> P{2}` the WASM signature becomes:

```
params:  (dest, p.x, p.y, q)        -- 4 params, dest first
results: (void)                      -- the callee stores into dest and returns nothing
```

Rules:

- `dest` is present **iff** the return type is an `@inline struct`.
- `dest` is index `0` when the function has no `this`, `1` when it does (after
  `this`, before the source parameters). Keeping it *first among the non-`this`
  parameters* makes its index a constant.
- The result becomes `None` — the value travels through memory, not the value
  stack.

### 4.2 Arity and the mapping helper

`numArguments` (source) is checked against source arity; `dest` is added when the
operand array is built, exactly as flattened arguments are added at emit today.

The helper's inverse must know about the hidden parameter:

```ts
sourceIndexOf(wasmIndex)
  0                       -> -1        // the hidden dest (no source counterpart)
  1..N+1 (with this)      -> shifted by one for the hidden slot
  else                    -> the source parameter owning it
```

Concretely: with `dest` present, every WASM parameter index after it shifts by
one relative to the no-sret case, and `-1` is the designated "no source
counterpart". `-1` is already the helper's out-of-range answer
(`sourceIndexOf` returns `-1` past the last parameter), so the sentinel exists
and needs no new convention — but the *doc comment* must say that `-1` now means
either "hidden" or "out of range", and callers that treat `-1` as "stop" (as
`operandsTostack` does) keep working.

### 4.3 The call site

Per call to a function returning `@inline struct`:

1. **Allocate** `sizeof<Return>()` bytes from the static call-temp stack, aligned
   to `alignof<Return>()`, remembering the mark to release.
2. **Emit the operands**: `dest` first, then the flattened source arguments in
   field order (PR #14's `expandSroaArgument`).
3. **Call.**
4. **Read the result** out of the buffer into the caller's SROA locals, one
   `local.set` per field, in field order — the mirror of `compileSroaLocal`.
5. **Release** the mark.

Steps 4 and 5 are adjacent, which is what bounds the buffer's life to the call:
after step 4 the caller owns the value as locals and the buffer is dead. If the
call's result is dropped (statement position), step 4 is skipped and the buffer
is still released.

### 4.4 The stub temp index — sret's `operandsTostack`

`compiler.ts:7070`:

```ts
let tempIndex = 1 + parameterTypes.length; // incl. `this`
```

Source-arity arithmetic for a temp **local index**. With a hidden destination
parameter the WASM arity is source+1, so this temp collides with the hidden
parameter's slot. **The fix is the same pattern PR #14 used: count WASM arity,
not source arity** — `1 + signature.wasmParamCount()` plus the hidden slot when
present.

This site is *predicted*, not yet exercised: it is the sret analogue of
`operandsTostack`, found by this note's own reasoning rather than by a test. By
`docs/session-findings.md`'s pattern, it should be assumed to be one of several;
the fixture run is the second enumeration.

### 4.5 What if it does not fit

Three shapes would force a "no":

- **A tuple that cannot express the shape.** Not the case: `module.ts:2207` takes
  an opaque `TypeRef`, and PR #14 already established that a tuple of N refs is
  buildable.
- **An ABI conflict.** Not applicable — sret is guest-internal. An `@external`
  *return* of `@inline struct` is refused and needs an ABI version, which is a
  different problem with a different answer (§9 of the scoping).
- **A layout hash move.** No: `layout_hash` folds host constants and host field
  names only (`arena.rs:1030-1104`). Nothing in this design touches guest ABI
  shape as the host sees it. **Zero hash move, zero adapter rebuild.**

So nothing at this design's scale forces a "no". The risks are implementation
risks (§6), not shape risks.

---

## 5. The fixtures

### 5.1 Three-way, the return cell

`interop/inline-struct-sret.ts`:

- **refuse** (today): `function make(): P` is refused by PR #12's rule —
  measured, `AS100 "an @inline struct value in a return type"` at the
  declaration plus a cascade at the `return` statement. The refuse cell is
  therefore "does not compile", which is the correct current state.
- **partial** (a callee that returns a *pointer to its own local*, or a caller
  that reads the destination after release): the value is read from a dead
  region. Asserted by a caller that calls the function **twice** and checks the
  first result is still intact after the second — a shared static slot without a
  mark/release would let call 2 overwrite call 1's value.
- **fixed**: `make()` returns a value the caller owns; two calls in sequence both
  hold their values; mutating the returned value's fields does not affect a
  subsequent call's result.

Assertion shape, mirroring PR #13's `599`-style cells: one number that
distinguishes all three readings (owned / aliased / dead) rather than a boolean.

### 5.2 The combined shape — `@inline` parameter *and* return

Source: `function f(p: P{2}, q: i32): P{2}` → WASM params
`(dest, p.x, p.y, q)`, result `void`.

The fixture asserts, in one function:

- the callee reads the right **source parameter** (proving the hidden slot did
  not shift the mapping);
- the callee writes the right **destination** (proving `dest` is where the
  caller put it);
- the caller's flattened arguments and its destination are both correct in one
  call — the interaction that neither the params fixture nor a return-only
  fixture covers.

Ordering assertion: with `dest` first, `p.x` at 1, `p.y` at 2, `q` at 3, a
wrong slot lands in a wrong field, and the value differs (the fixture's number
encodes all four positions, as `multiParamOrder() == 12534` does for parameters).

### 5.3 The stub-temp fixture

A class with an interface method whose *implementor* returns `@inline struct`
exercises `compiler.ts:7070`. Whether that shape is even reachable (an override
returning a value type) may itself be refused — if so, record the refusal and
note that the seventh site is unreachable until the refusal lifts.

---

## 6. Implementation risks, in the order they will bite

1. **The site list is not final.** §4.4's seventh site is predicted; expect
   more. The first fixture run is part of the measurement.
2. **The buffer's lifetime across a fault.** If the callee traps, the caller's
   release never runs and the static stack leaks capacity. The engine's model
   already treats a session as gone after a guest trap, so a leak that only
   exists in a dead session may be acceptable — but it must be *stated*, not
   discovered.
3. **Reentrancy.** A callee that calls back into a function returning
   `@inline struct` nests destinations. A mark/release stack handles this if
   release is LIFO; a single fixed slot would not.
4. **`sizeof<Return>()` in the caller** — already available (PR #12 made
   `sizeof` correct for records); the compile-time constant is what makes a
   static allocation expressible at all.

---

## 7. What could not be measured read-only

- **The buffer's capacity and overflow behaviour** — needs the allocator to
  exist. A fixed capacity with a named abort is the shippable first form.
- **The real cost of sret against multi-value results.** Multi-value is not
  actually cheaper: a `(dest, …)` hidden parameter *is* the shape multi-value
  would need too, since the callee must still write somewhere the caller can
  reach, and WASM multi-value returns of N scalars would require the callee to
  build them from locals — which it can. That alternative deserves its own
  measurement before this note's sret choice is treated as final; **it is not
  refuted here, only set aside.**
- **The stub-temp fixture's reachability** (§5.3) — an override returning a value
  type may be refused before the stub is ever built.

---

## 8. Why not multi-value results

Recorded so the choice is legible rather than assumed. `module.ts:2207` accepts a
tuple of results, so N scalar results are expressible. But:

- the callee's fields are locals, so producing N results means N `local.get`s at
  the return — mechanically fine;
- the **call site** must then accept N results and distribute them into the
  caller's field locals — which requires the call expression to carry N values,
  and every consumer of `compileExpression` assumes one `ExpressionRef`. That is
  the same class of change as the hidden parameter, but it touches the expression
  pipeline rather than the signature.

sret keeps the result a single `void` and moves the multi-value problem into
memory. That is why it is the smaller change **for this compiler's shape** — and
why §7 keeps the multi-value option open rather than closed.

**Correction, measured during implementation.** This section's framing —
"multi-value results set aside" — mischaracterised the problem. Sret does not
need multi-value results **because the model says there is no value**: the value
is memory end-to-end, and the pipeline never carries it. So the change did not
touch the expression pipeline at all — it relocated the problem from the call to
the read path. Recorded in `session-findings.md` as the read-back finding.

**The memory-only model has three legitimate consumers**, not two:

| Consumer | Shape | Emitted |
|---|---|---|
| `f().x` | one field read | a load from `(base + mark + offsetof x)`, then restore |
| `let q: P = f()` | per-field copy | one load and one `local.set` per field, then restore |
| `f()` (bare statement) | **discard** | mark, bump, guard, call, restore — **no read** |

The third was measured, not assumed: a bare `f()` compiles, and its WAT contains
no `local.get` of the slot and no address used as a value. It is a *consumer*
because it must still allocate a destination — the callee always writes one — and
because its unwind is the behaviour a leaked bump pointer would break (the
sret fixture asserts that a call after a discarded call starts at the same
slot). Everything outside these three is refused by name; the measurement is
pinned in `inline-struct-sret-refusal-reach.ts`.

**A fourth consumer of the same stack: the `@external` argument temp.** It is not
a consumer of a *return value* — it is the mirror problem, a value crossing
outward — but it uses the same region, the same mark/bump/guard/restore, and the
same per-frame mark, so it belongs in this note's accounting:

| Consumer | Direction | Slot content | Restore follows |
|---|---|---|---|
| `f().x`, `let q: P = f()` | inward (return) | the callee's result | the caller's read |
| `f()` (discard) | inward (return) | nothing is read | the call |
| `@external` parameter | outward (argument) | the caller's value, copied in | the call — the host reads during it |

**The `@external` contract is "borrowed for the call".** The restore after the
call is sound only because the host does not retain the pointer:
`tension_adapter.h` rule 6 (`:57-58`) states that an adapter "never caches a
pointer into guest memory and never holds a slice across a call", and its only
way to touch guest bytes is `guest_read(user, uint32_t ptr, void *dst, uint32_t
len)` (`:184`) — a `(ptr, len)` pair with no ownership. **If a host ever gains
async capability, that clause is what changes**, and the temp becomes a
dangling-pointer surface: the mark would have to stay live until the host
reports completion, which is a different lifetime model, not a tweak. Recorded
here so the change is a decision rather than a discovery. Re-entry *during* the
call is already safe — a WASM local is per-frame, so a nested call allocates
above the outer block and restores to it (measured: with the restore moved before
the call, the host's second read returns the inner temp's bytes).

---

## 9. Recommendation

**Proceed, as its own PR, with mechanism (B).** The order:

1. Establish the **static call-temp stack** (`alloc` / `release`, mark-based,
   below `__data_end`, never scanned) with the sret destination as its first and
   only client. This is where the risk is, and it is bounded: one slot per call,
   LIFO, released before the call expression returns its value.
2. Add the hidden destination parameter: `paramRefs`, the callee's store
   prologue, the call site's allocate/call/read/release, and §4.2's
   `sourceIndexOf`.
3. Fix `compiler.ts:7070` (§4.4) as part of the same change — it is the same
   site class PR #14 fixed, and leaving it is a known-broken stub.
4. Then the `@external` temp phase reuses the stack, with nothing new to design.

**Do not** implement sret and the `@external` temp as one PR (option A). The
reason is not size; it is that the `@external` temp's lifetime profile (one temp
per *argument*, in a call that may re-enter the guest) is materially harder than
sret's, and designing both against an unproven allocator would put the harder
shape first.
