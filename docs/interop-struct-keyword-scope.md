# `struct` keyword and post-type attributes — scoping

**Status:** scoping only. No source changed, no plan, no code.
**Base:** TensionScript `main` @ `50cceb36` (0.7.1) at
`/home/acakar/work/as-inspect/assemblyscript`; Tension `main` @ `2c1d587` for
the migration inventory. Published compiler `0.7.1` for behaviour claims.
**Siblings:** none — this is a new document. The interop scopes
(`docs/interop-scope.md`, `-addendum.md`, `-addendum-2.md`,
`interop-arrays-scope.md`, `interop-surface-scope.md`, `interop-tn-scope.md`,
`interop-0.8.0-scope.md`) live in the Tension repository and are not modified.
`docs/async-complete.md` is not modified.

**Where this lands.** TensionScript, on the `feat/0.8.0-interop` branch
(TensionScript PR 6), because the keyword it scopes is implemented there. The
Tension repository holds the *consumers* (the 33 declarations), not the
language.

**Method.** Behaviour claims are measured by compiling fixtures with the
published `0.7.1` (`bin/tensionscript.js`, built from `main`). Source claims
cite `src/`. Fixtures live in `/tmp/attr/`; none is in the repo.

---

## 0. The answer up front

**Proceed, with one migration and one hazard the design must not leave
implicit.**

1. **`struct` is a used identifier in exactly one guest-parseable file.**
   `tests/compiler/function-inline-regressions.ts:35` declares
   `const struct = changetype<Struct>(0);` and uses it at `:28-30`. Everywhere
   else it is a comment, a string, or a *member name* — and member names may be
   keywords (measured: `class: i32` and `switch: i32` both compile). So the
   keyword is **not** purely additive; it needs that one file renamed.
2. **Post-type `@` does not parse today** — `TS1003 Identifier expected` for
   `x: f32 @foo`, `@foo("bar")`, and `@foo @bar`. The mechanism is precise: the
   field parse ends at `:2595` with a non-erroring `tn.skip(Token.Semicolon)`,
   so the `@` is re-read as a **decorator on the next member** — which is why
   `x: f32` ⏎ `@foo` ⏎ `y: f32` *compiles*, silently attaching `@foo` to `y`.
3. **The disambiguation rule has a mechanism already.** `peekOnNewLine()`
   (`tokenizer.ts:991`, 25 call sites) is how this parser decides
   "same line vs new statement" everywhere else, including `checkASI`
   (`parser.ts:4634-4644`). The rule the design wants — line-start `@` binds
   forward, same-line post-type `@` binds to the type — is implementable with
   the existing primitive.
4. **`@inline` on a class already errors, but with the wrong message.** Measured:
   `AS212 Decorator '@inline' is not valid here` via `checkDecorators`
   (`program.ts:1976-2005`, class call at `:2098-2102`). The reserved form needs
   a *specific* diagnostic, not the generic one — otherwise the "not yet
   implemented" signal is indistinguishable from "you misplaced a decorator".
5. **The 0.8.0 → 0.9.0 `struct` flip is the real hazard.** At 0.8.0 `struct Foo`
   and `@unmanaged struct Foo` must mean the same thing; at 0.9.0 plain `struct`
   becomes managed. Code that compiles at 0.8.0 changes meaning at 0.9.0 with no
   diagnostic. §8.4 states the deprecation that prevents it, and it is the one
   thing this scoping recommends adding to the 0.8.0 release beyond the plain
   rename.

---

## 1. Is `struct` already an identifier? (Item 1)

### 1.1 The guest-parseable corpus — one conflict

`tests/compiler/*.ts` is guest source: `tests/compiler.js` compiles each through
`dist/asc.js`. A bare-token scan (comments and string literals removed) finds
**one** file:

```
tests/compiler/function-inline-regressions.ts:28    struct.v0 = v0;
tests/compiler/function-inline-regressions.ts:29    struct.v1 = v1;
tests/compiler/function-inline-regressions.ts:30    struct.v2 = v2;
tests/compiler/function-inline-regressions.ts:35  const struct = changetype<Struct>(0);
```

One declaration, three uses. This is the whole guest-side conflict in
TensionScript.

Measured: a keyword may **not** be a free-standing variable name —
`const class = 5;` is `TS1003 Identifier expected` (and a follow-on `TS1005`).
So `const struct = …` stops parsing the moment `struct` becomes a token.

### 1.2 Member names are not a conflict

Measured, and this is what keeps the blast radius small:

```
class F { class: i32; }   → compiles;  f.class reads it
class F { switch: i32; }  → compiles;  f.switch reads it
```

Field, method and property names already accept keywords (the member parser
reads a prefer-identifier name at `parser.ts:2311-2319` with
`IdentifierHandling.Always`, and the property-access parser uses
`skipIdentifier(IdentifierHandling.Prefer)`). So the Tension framework's records
— and `src/`'s own `Type.struct` — do not need renaming.

### 1.3 `src/` — one member name, zero free-standing uses

`src/` is self-hosted (`package.json`'s `asbuild` target compiles it as guest
code), so it is in scope for this question. A bare-token scan with comments and
strings removed finds **one** hit:

```
src/types.ts:864    static readonly struct: Type = new Type(TypeKind.Struct,
```

That is a member name (§1.2), not an identifier. The other 56 textual hits are
comments (`module.ts:94`, `async/lower.ts:160-223`, and so on). **No `src/`
change is required.**

### 1.4 The Tension tree — zero

The 33 `@unmanaged` declarations (`ogre/wire.ts` 24, `runtime/wire.ts` 9) have
**no** field or method named `struct`, and no framework or example source uses
`struct` as an identifier outside comments and JSDoc `{@link …}`. Count: **0**.

### 1.5 The migration

One file, four lines:

```
tests/compiler/function-inline-regressions.ts
  :35  const struct = changetype<Struct>(0);   →  rename the local
  :28-30  struct.v0/.v1/.v2                    →  follow the rename
```

Mechanical, in the test corpus, no behaviour change. The regression this file
guards is `@inline`-related function-inlining behaviour (`:11`, `:19` are
`@inline` functions), not the name.

---

## 2. Does post-type `@` parse? (Item 2)

**No.** All three shapes are refused, and the diagnostic is the same code in
each:

| fixture | result |
|---|---|
| `class F { x: f32 @foo; }` | `TS1003 Identifier expected`, caret in the `@foo` range |
| `class F { x: f32 @foo("bar"); }` | `TS1003 Identifier expected` |
| `class F { x: f32 @foo @bar; }` | `TS1003 Identifier expected` |

### 2.1 Why — the mechanism, not the symptom

The field parse ends at `parser.ts:2594-2596`:

```ts
if (!(isInterface && tn.skip(Token.Comma))) {
  tn.skip(Token.Semicolon);      // non-erroring: no checkASI here
}
return retField;
```

`tn.skip` does not report when the token is not `;`. So after `x: f32` the
member is returned with `@foo` still in the stream, and the class-member loop
(`parser.ts:1887-1907`) calls `parseClassMember` again. That function's first
act is the decorator block (`parser.ts:1989-1999`), which consumes `@foo` as a
**decorator for the member it is about to parse** — and there is no member,
because `;` follows. Hence `TS1003` at the decorator.

### 2.2 The consequence that matters more than the error

Because the `@` binds *forward*, this compiles today:

```ts
class F {
  x: f32
  @foo
  y: f32
}
```

Measured: it compiles, with `@foo` attached to **`y`**. `@foo` is an unknown
decorator and is silently ignored — the `@fieldOffset` lesson, already shipping.
Any new grammar must not preserve that reading for a same-line attribute, and
must decide explicitly what a line-start attribute means.

### 2.3 The disambiguating primitive already exists

`peekOnNewLine()` (`tokenizer.ts:991`) is the parser's existing "is the next
token on a new line" test, used at 25 sites, including `checkASI`
(`parser.ts:4634-4644`: `if (nextToken == EndOfFile || nextToken == CloseBrace
|| tn.peekOnNewLine()) return;`). So the architect's rule —

- attributes at line start attach to the **following** declaration;
- attributes after a type on the **same line** attach to that type —

is expressible with the same predicate the language already uses for statement
termination. No new lexer state is needed.

---

## 3. The modifier / annotation split (Item 3)

### 3.1 The compiler's closed set today

`DecoratorKind` (`src/ast.ts:1032-1047`), mapped to flags by
`DecoratorFlags.fromKind` (`program.ts:3021-3033`):

```
Custom, Global, Operator, OperatorBinary, OperatorPrefix, OperatorPostfix,
Unmanaged, Final, Inline, External, ExternalJs, Builtin, Lazy, Unsafe
```

`DecoratorKind.fromNode` (`ast.ts:1049-1100`) resolves a name to one of these
and everything else to `Custom`. Property-access names (`@operator.binary`) are
handled in the same function — which is why `@abi.alias` will parse without any
lexer change.

`checkDecorators` (`program.ts:1976-2005`) is the gate: a known flag not in the
element's `acceptedFlags` is `AS212 Decorator '{0}' is not valid here`; an
unknown name is `Custom` and passes silently.

### 3.2 What the tree actually uses

| decorator | uses in Tension's guest sources | kind |
|---|---|---|
| `@external` | 63 | built-in |
| `@unmanaged` | 40 | built-in |
| `@inline` | 2 (`anim/evaluator.ts:81`, `tests/guest-anim-eval.ts:92`) | built-in |
| `@link` | 5 textual, all JSDoc `{@link …}` | not a decorator |

No other decorator appears. So the **modifier** set the compiler must recognise
for the new forms is exactly `@unmanaged` and `@inline` — the two the design
names. There is no third modifier candidate hiding in the tree.

### 3.3 `@fieldOffset` — an annotation, and it does not exist in the tree

`@fieldOffset` has **0 uses** in the Tension framework or examples. The surface
scope's finding (`docs/interop-surface-scope.md` §2.5) was a *probe*: writing
`@fieldOffset(16)` compiles and is silently ignored, because the name resolves
to `Custom` and nothing consumes it.

Classification: it is an **annotation** (a layout instruction), and under the
namespace design it becomes `@abi.offset(N)` — annotation, not modifier. The
silent-ignore defect is reported here, not fixed: it is the precedent the
`@inline` reservation must not repeat (§5).

### 3.4 The namespaces

| namespace | contents | open or closed |
|---|---|---|
| core | `@unmanaged`, `@inline` | **closed** — the compiler decides |
| `@abi.*` | `@abi.alias`, `@abi.export`, `@abi.transfer`, `@abi.offset` | closed set, ABI concerns only |
| other (`@memory.*`, tooling) | annotations | open — `Custom`, ignored unless a tool consumes them |

`@external` stays where it is (an import declaration's marker, 63 uses); it is
not an ABI namespace member and does not move.

---

## 4. The AST shape (design question 2)

**Post-type attributes belong on the `TypeNode`, not on the `FieldDeclaration`.**

The reason is mechanical: the same type appears in a parameter, a return type, a
local's annotation, and a field (`parseType` is called from all four —
`parser.ts:933`, `:1062`, `:1597`, `:2554`). An attribute that changes the
*type*'s meaning (`@unmanaged`, `@inline`) must travel with the type, or the same
spelling means different things in different positions.

The shape:

```
TypeNode            (src/ast.ts:844, abstract)
  attributes: DecoratorNode[] | null      ← new, on the base class
  NamedTypeNode / FunctionTypeNode / TupleTypeNode / <new> StructTypeNode
```

Declaration decorators stay exactly where they are — `DecoratorNode[]` on
`ClassDeclaration`, `FieldDeclaration`, `FunctionDeclaration`. The two lists are
distinct and never merged; a `@unmanaged` in `decorators` keeps its current
meaning (§7 is unaffected), and a `@unmanaged` in `TypeNode.attributes` is the
new position.

---

## 5. The `@inline` hard error (Item 4)

### 5.1 Where it fires

`checkDecorators` (`program.ts:1976-2005`) is already called on every class at
`program.ts:2098-2102` with `Global | Final | Unmanaged`. `@inline` there
produces the generic refusal (measured):

```
$ tensionscript d1.ts        # @inline class F { x: f32; }
ERROR AS212: Decorator '@inline' is not valid here.
```

That is the wrong signal — it says "misplaced", not "not yet built".

### 5.2 The shape to use

`DiagnosticCode.Not_implemented_0` is **AS100**
(`src/diagnosticMessages.json:2`, `"Not implemented: {0}": 100`) — the existing
"declared but not built" machinery, used for exceptions (`AS100: Not
implemented: Exceptions`) and for the async refusals.

```
ERROR AS100: Not implemented: value types (@inline struct) are not yet
implemented; coming in a future release.
```

Fires at **resolve time**, inside `checkDecorators`' class call, before any
member is compiled — the same pass that reports `AS212` today, so no codegen
path can be reached first. This satisfies the "must not silently parse-and-
ignore" requirement by construction: the diagnostic is produced by the same gate
that already runs on every class, and `Not_implemented_0` is non-suppressible
in the ordinary build.

**The `@fieldOffset` contrast, stated:** `@fieldOffset` silently parsed because
it resolved to `Custom` and no `checkDecorators` arm claimed it. `@inline` does
**not** resolve to `Custom` — `DecoratorKind.Inline` exists (`ast.ts:1039`) and
`DecoratorFlags.Inline` is mapped (`program.ts:3028`), so it reaches the gate.
The reservation reuses an existing kind; it does not depend on a new one being
noticed.

---

## 6. The 33 declarations (Item 5)

Source: Tension `main` @ `2c1d587`. Counts are declared field names (`name:
type`), comments stripped.

| # | file:line | name | fields |
|---|---|---|---|
| 1 | `ogre/wire.ts:29` | `Vec2f` | 2 |
| 2 | `ogre/wire.ts:36` | `Vec3f` | 3 |
| 3 | `ogre/wire.ts:44` | `Vec3f16` | 4 |
| 4 | `ogre/wire.ts:53` | `Vec4f` | 4 |
| 5 | `ogre/wire.ts:62` | `Quatf` | 4 |
| 6 | `ogre/wire.ts:71` | `Colourf` | 4 |
| 7 | `ogre/wire.ts:80` | `Mat4f` | 16 |
| 8 | `ogre/wire.ts:89` | `Transformf` | 12 |
| 9 | `ogre/wire.ts:106` | `Aabbf` | 8 |
| 10 | `ogre/wire.ts:121` | `StringRef` | 2 |
| 11 | `ogre/wire.ts:128` | `BufferRef` | 2 |
| 12 | `ogre/wire.ts:137` | `SceneNode` | 19 |
| 13 | `ogre/wire.ts:174` | `LightRecord` | 25 |
| 14 | `ogre/wire.ts:234` | `CameraRecord` | 19 |
| 15 | `ogre/wire.ts:273` | `TextureSlot` | 4 |
| 16 | `ogre/wire.ts:282` | `Material` | 53 |
| 17 | `ogre/wire.ts:346` | `ShaderRecord` | 9 |
| 18 | `ogre/wire.ts:360` | `ResourceReq` | 8 |
| 19 | `ogre/wire.ts:373` | `Resource` | 11 |
| 20 | `ogre/wire.ts:389` | `Buffer` | 10 |
| 21 | `ogre/wire.ts:404` | `Renderable` | 17 |
| 22 | `ogre/wire.ts:461` | `MotionUpdate` | 15 |
| 23 | `ogre/wire.ts:488` | `BoneUpdate` | 15 |
| 24 | `ogre/wire.ts:508` | `Job` | 13 |
| 25 | `runtime/wire.ts:107` | `ArenaControl` | 40 |
| 26 | `runtime/wire.ts:158` | `SessionInfo` | 28 |
| 27 | `runtime/wire.ts:195` | `RegionDesc` | 6 |
| 28 | `runtime/wire.ts:206` | `TableHeader` | 7 |
| 29 | `runtime/wire.ts:223` | `EventRecord` | 7 |
| 30 | `runtime/wire.ts:235` | `FrameState` | 10 |
| 31 | `runtime/wire.ts:255` | `StringHalf` | 4 |
| 32 | `runtime/wire.ts:264` | `Callbacks` | 11 |
| 33 | `runtime/wire.ts:283` | `Subscription` | 4 |

### 6.1 The rename, and the 0.8.0 semantics

`@unmanaged class Foo { … }` → `struct Foo { … }`, or `@unmanaged struct Foo
{ … }`. At **0.8.0 both spellings are the same declaration**: `struct` without a
modifier is the borrowed form, and `@unmanaged struct` is the explicit spelling
of it. The distinction arrives at 0.9.0 (§8).

The rename is **layout-neutral by construction**: same fields, same declaration
order, same `CommonFlags`/`DecoratorFlags`. It is a token substitution in 33
places, and the compiler's layout loop (`resolver.ts:3677-3682`) never sees the
keyword.

### 6.2 Verification, and what cannot be measured yet

- **`offsetof` unchanged:** the 128 `offsetof<` sites in the framework are
  compile-time constants (`builtins.ts:1343-1357`); a rename that changes no
  field and no order cannot move them.
- **`layout_hash` unchanged: 786288195** (`tension-core/src/session/arena.rs:1678`).
  It is a pure function of host constants (`:1030-1104`, field tables
  `:1110-1200`); guest declarations are not inputs. A guest-side rename cannot
  move it.
- **Not executable today:** the rename cannot be compiled until `struct` parses.
  So "offsetof and the hash are unchanged" is a *derivation* from the layout
  loop and the hash's inputs, not a measurement. The measurement becomes
  available the moment the keyword lands, and it is the first gate for the
  downstream PR.

**The migration is a Tension change, not a TensionScript change** — the 33
declarations live in the Tension framework, so the rename ships in the Tension
adoption PR after 0.8.0 publishes, alongside the `sizeof`/`COPY_STRUCT`/`T[N]`
adoption already scoped.

---

## 7. `@abi.alias` (design question 3)

**The two coexist, and nothing moves.**

- `offsetof<T>("field")` keeps taking the **TypeScript** field name —
  `builtin_offsetof` looks the member up by its declared name
  (`builtins.ts:1343-1348`, `classReference.getMember(fieldName)`). All 128
  framework sites keep working, unchanged, because the alias is a separate
  lookup.
- `abiNameOf<T>("field")` is a **new** builtin returning the alias string. It
  follows the shape of `nameof` (`builtins.ts:1362-1380`: string result,
  `checkConstantType`, materialized as a static string), with the field-name
  argument shape of `offsetof` (`:1305-1357`).
- **`layout_hash` does not move.** The fold reads host constants
  (`arena.rs:1030-1104`); an alias is guest-side metadata that the host never
  sees. Adding `@abi.alias` to a guest declaration changes no host constant.
- **The ABI is not renegotiated.** `TENSION_ADAPTER_ABI_VERSION 3`
  (`tension_adapter.h:78`) is untouched; aliases are a compile-time string
  facility.

`@abi.alias` is therefore the cheapest of the four ABI annotations and can ship
in the same release as the keyword without coordination.

---

## 8. Version boundary (design question 5)

| release | contents | breaking set |
|---|---|---|
| **0.8.0** | `struct` joins `class`; `struct Foo` == `@unmanaged struct Foo`; post-type attributes parse; `@inline` reserved with a hard error; `@abi.alias` | the `sizeof` variant-B change (TensionScript PR 6); **one test file renamed**; no consumer breakage identified |
| **0.9.0** | plain `struct Foo` becomes **managed** C-layout; `@unmanaged struct Foo` remains the borrowed form | every 0.8.0 plain-`struct` declaration changes meaning |
| **1.0** | `@inline struct` becomes a **value type** (copied on escape) | the `@inline` reservation is lifted; `@inline` gains semantics |

### 8.4 The 0.8.0 → 0.9.0 flip — the hazard

At 0.8.0 `struct Foo` means borrowed. At 0.9.0 `struct Foo` means managed. A
guest written against 0.8.0 with plain `struct` compiles at 0.9.0 and lays out
differently — silently, which is exactly the failure class this phase exists to
remove.

**The mitigation this scoping recommends for 0.8.0:** emit a deprecation
warning on a *plain* `struct` declaration, naming `@unmanaged struct` as the
stable spelling, from the day the keyword ships. Then 0.8.0 code is written in
the form that survives 0.9.0, and the rename is a warning rather than a silent
layout change. The alternative — reserving plain `struct` for 0.9.0 and shipping
only `@unmanaged struct` at 0.8.0 — removes the flip entirely but makes the new
keyword inert for one release, which does not serve the 33 declarations the
rename is for.

**Recommendation between those two: deprecation warning.** It lets the 33
declarations adopt the short spelling immediately and keeps 0.9.0 from being a
silent meaning change. This is the one addition to the 0.8.0 scope it proposes.

---

## 9. What forces a "no" (design question 6)

1. **`struct` is a used identifier.** It is — one file, four lines (§1.1). That
   is a migration, not a blocker: the file is a compiler regression test, the
   rename is mechanical, and it ships in the same commit as the keyword.
2. **Post-type `@` conflicts with an existing production.** It does not: the
   field parse ends at `:2595` and post-type `@` is currently *unconsumed by
   the field*, so a production inserted there is additive. The one behaviour it
   changes is the accidental forward-binding of `x: f32` ⏎ `@foo` (§2.2), which
   is a defect rather than a contract.
3. **The `@inline` hard error cannot fire at parse/resolve.** It can:
   `checkDecorators` (`program.ts:1976`) runs on every class at resolve time and
   already sees `DecoratorFlags.Inline` (`program.ts:3028`).
4. **A keyword breaks self-hosting.** It does not: `src/`'s only `struct` token
   is the member name at `types.ts:864`, and keywords are valid member names
   (§1.2).

None fires. The scoping proceeds.

---

## 10. Recommendation

**Proceed.** The implementation plan for the next turn, in order:

1. **`Token.Struct`** — one arm in the tokenizer's `s` block
   (`tokenizer.ts:316-325`, `len == 6` already handles `switch`/`static`) and
   the enum entry near `Token.Class` (`tokenizer.ts:53`); dispatch it to the
   existing `parseClassOrInterface` (`parser.ts:354-359`) with a
   `CommonFlags`/`DecoratorFlags` marker that records "declared with `struct`".
2. **Rename the one test** (`tests/compiler/function-inline-regressions.ts`,
   §1.1), in the same commit.
3. **Post-type attributes** — `attributes: DecoratorNode[] | null` on
   `TypeNode` (`ast.ts:844`); a production in the field/local/parameter type
   position guarded by `!tn.peekOnNewLine()`, reusing `parseDecorator`
   (`parser.ts:965`) for the `@name` / `@name(args)` / `@ns.name` shapes.
4. **The `@inline` reservation** — an `AS100` (`Not_implemented_0`) arm in
   `checkDecorators` for `DecoratorFlags.Inline` on a `struct` declaration.
5. **`@abi.alias` + `abiNameOf`** — a builtin beside `nameof`
   (`builtins.ts:1362`), and the alias stored on the resolved `Property`.
6. **The deprecation warning for plain `struct`** (§8.4).
7. **The fixture set** — three-way per piece, on the real backend:
   - `struct` refuse/partial/fixed: today `TS1109` at the `:`; partial = the
     keyword parses but `@unmanaged` is not implied; fixed = `offsetof` and
     `layout_hash` unchanged over a renamed record;
   - post-type attribute refuse/partial/fixed: today `TS1003`; partial = it
     parses but attaches to the next member (the §2.2 defect); fixed = it
     attaches to the type;
   - `@inline` refuse/partial/fixed: today `AS212`; partial = silence (the
     `@fieldOffset` shape); fixed = `AS100`.

**Affected repo:** TensionScript only, until publish. The 33 declarations are
renamed in the Tension adoption PR after 0.8.0, and that PR's first gate is the
unchanged `offsetof` set and `layout_hash` **786288195**.

---

## 11. What could not be measured read-only

- **The rename's effect on `offsetof` and `layout_hash`** — the 33 declarations
  cannot be renamed until `struct` parses. §6.2 derives the result from the
  layout loop and the hash's inputs; it is not a measurement.
- **A `struct`-parsing compiler** — no such build exists; every §8 behaviour is
  specified, not run.
- **The `@abi.alias` builtin** — not written; the `nameof` shape is cited as the
  template, not measured as an implementation.
- **The full TensionScript suite under the keyword** — the conflict inventory
  (§1) is exhaustive over `tests/**/*.ts`, but the suite was not run with a
  `struct` token added.
- **Tooling outside this repo** — editors, formatters, and the registry's
  syntax highlighting for `struct` were not inspected.
- **The Tension-side build** — the framework cannot be compiled against a
  `struct`-aware compiler that does not exist.

---

## Appendix — probes and citations

**A. Post-type `@` fixtures** (`/tmp/attr/`, `bin/tensionscript.js` built from
`main` @ `50cceb36`).

```
a1.ts  class F { x: f32 @foo; }            TS1003 Identifier expected
a2.ts  class F { x: f32 @foo("bar"); }     TS1003 Identifier expected
a3.ts  class F { x: f32 @foo @bar; }       TS1003 Identifier expected
b1.ts  class F { x: f32 \n @foo \n y: f32 }  compiles (@foo binds to y)
b2.ts  class F { @foo x: f32; }             compiles (unknown decorator ignored)
b3.ts  class F { x: f32 @fieldOffset(16); } TS1003 Identifier expected
d1.ts  @inline class F { x: f32; }          AS212 Decorator '@inline' is not valid here
e1.ts  struct F { x: f32; }                 TS1109 Expression expected
f1.ts  class F { class: i32; }              compiles
f2.ts  class F { switch: i32; }             compiles
g1.ts  const class = 5;                     TS1003 Identifier expected
```

**B. Identifier scans.**

```
Tension guest sources:  struct as identifier or member name → 0
TensionScript src/:     1 member name (types.ts:864); 0 free-standing
TensionScript tests/:   1 file, 1 declaration + 3 uses
                        (compiler/function-inline-regressions.ts:28-30, :35)
```

**C. Source citations.**

- Keyword table: `tokenizer.ts:316-325` (`s`, len 6 → `switch`, `static`);
  `Token.Class` at `tokenizer.ts:53`; `peekOnNewLine` at `tokenizer.ts:991`.
- Parser: `parseType` `parser.ts:537`; bracket loop `:739-752`; class/interface
  dispatch `:354-359`; class-member loop `:1887-1907`; decorator block
  `:1989-1999`; `parseDecorator` `:965-1005`; field type `:2554`; field
  terminator `:2594-2596`; `checkASI` `:4634-4644`; member name `:2311-2319`.
- AST: `TypeNode` `ast.ts:844`; `NamedTypeNode` `:913`; `DecoratorKind`
  `:1032-1047`; `fromNode` `:1049-1100`.
- Program: `checkDecorators` `program.ts:1976-2005`; class call `:2098-2102`;
  `DecoratorFlags.fromKind` `:3021-3033`.
- Builtins: `offsetof` `builtins.ts:1305-1357` (lookup `:1343-1348`, size
  `:1357`); `alignof` `:1283-1300`; `nameof` `:1362-1380`; `BuiltinNames`
  `:175-200`.
- Diagnostics: `Not_implemented_0` = 100 (`diagnosticMessages.json:2`);
  `Decorator_0_is_not_valid_here` = 212 (`:27`); `Decorators_are_not_valid_here`
  = 1206 (`:122`).
- Tension: `tension-core/src/session/arena.rs:1030-1104` (the fold),
  `:1110-1200` (the field tables), `:1678` (`786_288_195`);
  `tension-core/include/tension_adapter.h:78` (ABI 3);
  `tension-framework/assembly/ogre/wire.ts`, `runtime/wire.ts` (the 33).
- Prior scopes: `docs/interop-surface-scope.md` §2.5 (`@fieldOffset` silently
  ignored); `docs/interop-0.8.0-scope.md` §10 (variant B, Decision 2);
  `docs/interop-scope.md` §6.3 (`store` is a reference operation).
