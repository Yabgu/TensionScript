# Changelog

## Unreleased

Developer-facing: `npm test` now runs the lint step via `pretest`; a fresh
clone without a build fails at `pretest` naming the generated file. Build
first (`npm run build`) as before — the requirement is unchanged, the error
is clearer.

## 0.9.0

### `@managed struct`

A GC-owned record with a C-compatible layout: heap-allocated, traced, and
nullable, where `struct` is borrowed and `class` guarantees no layout. The
reference **is** the fields pointer, so `host.call(foo)` receives the record's
fields with no conversion, `sizeof<Foo>()` is C's size, and `offsetof<Foo>("b")`
is the field's offset from that pointer.

```ts
@managed struct Vec3 { x: f32 = 0; y: f32 = 0; z: f32 = 0; }
const v = new Vec3();     // GC-owned
submit(v);                // the host sees the Vec3's fields
```

Three kinds, and the choice is about ownership and layout, not about syntax:

| | GC | C layout | passed to the host as |
|---|---|---|---|
| `class` | yes | no | a reference |
| `struct` | no | yes | a pointer the author supplies |
| `@managed struct` | yes | yes | the fields pointer |

A managed struct is **final** — no inheritance, no virtual dispatch — because a
subclass would put fields past the extent `sizeof` already reported. It refuses
`T[N]` fields and `COPY_STRUCT` by name (see *Known limitations*).

### Known limitations

- **`T[N]` fields in any constructed type crash the compiler** — pre-existing,
  and not specific to managed structs: field initialization cannot fill an
  extent (`makeZero` has no `FixedArray` case), so `new` on any type with an
  inline array traps the build. `@managed struct` refuses such a field by name
  rather than promise it; the fix is a separate compiler phase. Borrowed
  `struct` keeps `T[N]` as 0.8.x had it.
- **Inline arrays of GC references are untraced** (`isManaged<Other[4]>()` is
  false), so they are refused on a managed struct.
- **`COPY_STRUCT` does not accept a managed struct.** It is a raw byte copy; the
  write barrier it skips is exactly what a managed destination needs. A managed
  copy needs a method with the barrier in it, not a primitive.
- **The host must not retain a pointer past the call.** `host.call(foo)` roots
  the object across the call, so a synchronous host is safe; nothing keeps it
  alive after the call returns. `@abi.transfer` is not implemented, so this is a
  contract, not a checked property.

### `struct` stays unmanaged, permanently

The 0.9.0 flip announced in 0.8.0 is **cancelled**. `struct` means
`@unmanaged struct` today and always will. A plain `struct` no longer warns: the
TS6385 deprecation that 0.8.x emitted is removed. Code that added `@unmanaged`
to silence it keeps working unchanged, and is now redundant but valid.

### Breaking changes

None from 0.8.x. Every 0.8.x program compiles to the same bytes; `class` and
`struct` are untouched, and this release only *removes* a warning.

## 0.8.1

Republish. The 0.8.0 tarball shipped a `dist/` of five files and 488 bytes: the
publish ran without a build, so `dist/` contained only its tracked members;
`files: ["dist/"]` packs the ignored artifacts when they exist, so running the
build first is the fix. `package.json` exported `./dist/asc.js`, which was not in
the tarball. Every install failed to load:

```
ERR_MODULE_NOT_FOUND: Cannot find module .../dist/asc.js
  imported from .../bin/tensionscript.js
```

0.8.1 republishes with the built `dist/` and adds a `prepublishOnly` guard —
`npm run build && npm run publish:verify`, where `scripts/verify-dist.js`
asserts the artifacts exist and clear a sanity floor — that refuses to publish
if `dist/asc.js` or `dist/assemblyscript.js` is missing or undersized.

**No API changes from 0.8.0.** Any consumer that managed to install 0.8.0 could
not load it; 0.8.1 is a drop-in replacement.

*Diagnosis, corrected by measurement.* The first account of this said
`.gitignore` excludes `dist/` from the tarball. It does not: `files: ["dist/"]`
wins, and the ignored artifacts — `asc.js`, `assemblyscript.js`,
`*.generated.d.ts`, `*.map`, `importmap.json`, `web.js` — are packed whenever
they exist on disk. Measured with `npm pack --dry-run`, the built tree packs 13
files under `dist/` and the same tree with those artifact groups removed packs 5.
The failure was an absent build, not an exclusion rule. So `prepublishOnly`
running the build is the load-bearing half of the guard, and `publish:verify` is
the assertion that the build landed; either alone is insufficient, because a
build that emits nothing looks like one that worked until you look.

*Discipline note extension.* Verify the tarball loads, not just that the version
is on the registry. `npm view <pkg> version` proves the version exists;
`npm pack` + `tar -tzf` + install + `--version` proves it works. The guard makes
the second check unnecessary for this failure — the publish now aborts rather
than shipping an empty `dist/` — but the check is still what tells you whether
the artifact the registry serves is the one you built.

```
npm view @acakar/tensionscript version --prefer-online
npm pack @acakar/tensionscript@0.8.1
tar -tzf acakar-tensionscript-0.8.1.tgz | grep dist/asc.js
tar -tzf acakar-tensionscript-0.8.1.tgz | grep dist/assemblyscript.js
npm install -g acakar-tensionscript-0.8.1.tgz
tensionscript --version
```

After publishing 0.8.1, the maintainer should deprecate 0.8.0 so its installers
are warned:

```
npm deprecate @acakar/tensionscript@0.8.0 'Broken tarball (no dist/); install 0.8.1 or later'
```

0.8.0 cannot be unpublished after 72h; deprecation is the correct response.
0.8.1 is a drop-in replacement.

## 0.8.0

The interop bundle: the guest describes a C record in the language, and the
compiler lays it out the way C does.

### `sizeof<@unmanaged T>` is the record's size

`sizeof<T>()` on an `@unmanaged` class now returns the record's layout size:
the field offsets with inter-field padding, rounded up to the record's
alignment — C's `sizeof`. It was the pointer width (4) before variant B, and
then the offset where the last field ends, which under-sized every record whose
last field is narrower than the record's alignment (`{a: u8; arr: u32[8]; b: u8}`
is 40 bytes, not 37).

`offsetof<T>()` with no field argument is the same number; both builtins read
the layout, so they move together. A field's offset
(`offsetof<T>("field")`) is unchanged, so addressing is unchanged.

**Breaking** only for a consumer that read `sizeof` on an `@unmanaged` record
and expected the pointer width. There is no such caller in the tree — the only
in-tree `sizeof<T>()` is `sizeof<usize>()` — which is why this is a minor
release. A managed class is unaffected: `sizeof<managed T>` is still 4.

### `COPY_STRUCT`

`std/assembly/util/bytes.ts`: `COPY_STRUCT<T>(dst, src)` is
`memory.copy(dst, src, offsetof<T>())` — the struct-copy primitive, matching C's
`memcpy(dst, src, sizeof(S))` now that `offsetof<T>()` is the record's size.

`load<T>` / `store<T>` are **reference operations**, not struct copies: they
read and write one word at a `@unmanaged` reference, which is what the
allocator's block links want. The originally planned refusals for them were
dropped (`docs/interop-scope.md` §6.3, `tlsf.ts`'s six sites); `COPY_STRUCT` is
the struct-copy path.

### `struct`

`struct Foo { … }` is `@unmanaged class Foo { … }` at 0.8.0 — the same keyword
the same declaration, one decorator, no second code path. A plain `struct`
emits a deprecation warning (TS6385), because at 0.9.0 the same spelling becomes
a managed C-layout reference type.

### Post-type `@` attributes

An attribute may follow the type: `m00: f32 @abi.alias("m00")`. On the same
line it attaches to the type; after a newline it still attaches to the *next*
member, as before.

### `@abi.alias` and `abiNameOf`

`@abi.alias("name")` names a field for the other side of an ABI without moving
it; `offsetof<T>("field")` keeps taking the TypeScript name, so an alias can
never shift a byte. `abiNameOf<T>("field")` returns the alias, or the TypeScript
name when there is none. Compile-time; no runtime cost. With two aliases on one
field the first is canonical.

### `@inline` is reserved

`@inline` on a struct declaration is a hard error (AS100, "Not implemented:
value types"). Value types are a later release; the reservation refuses by name
rather than parsing and ignoring.

### `T[N]`: inline fixed-size arrays

`f32[4]`, `u32[8]`, `f32[6]` — `N` inline elements, not an `Array<T>`
reference. Usable as struct fields, with `sizeof`/`offsetof`, indexed reads and
writes, compound assignment and `++`/`--`. The layout aligns a field by its
*element's* alignment (4 for `f32[6]`, whose 24-byte size is not a power of
two), so `{a: i32; arr: f32[4]; b: i32}` is 24 bytes with `arr` at 4 and `b` at
20. At `-O3` a constant-index access is two instructions (`local.get`,
`f32.load offset=N`).

`T[N]` is what `tension-input`'s `StateRecord.keysHeld[8]` and
`PadRecord.axes[6]` were hand-addressed for.

## 0.9.0 preview

Plain `struct` becomes a **managed** C-layout reference type; the borrowed
(by-value, unmanaged) form is spelled `@unmanaged struct`.

Migration: mark every declaration that intends the borrowed form now.

```ts
// 0.8.0 -- warns (TS6385), and means @unmanaged
struct Vec3 { x: f32; y: f32; z: f32; }

// 0.9.0 -- the spelling that keeps meaning the borrowed form
@unmanaged struct Vec3 { x: f32; y: f32; z: f32; }
```

The TS6385 warning is the signal. `sizeof<managed T>` stays the reference width
(4); `sizeof<@unmanaged T>` stays C's `sizeof`.
