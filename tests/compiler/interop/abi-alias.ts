// `@abi.alias` and `abiNameOf`, 0.8.0.
//
// The alias is guest-side metadata: it names a field for the other side of an
// ABI without changing where the field lives. `offsetof` keeps taking the
// TypeScript name, so an alias can never move a byte; `abiNameOf` is the
// lookup that reads the alias.
//
// Three-way, as assertions:
//   refuse  (before): `@abi.alias` did not parse in type position (TS1003).
//   partial (the alias recorded but not reachable, or attached to the
//           declaration instead of the type): `abiNameOf` would fall back to the
//           TS name for every field. The `aliased` assertions below fail.
//   fixed: the alias is returned; no alias returns the TS name; with two
//          aliases the first is canonical.

struct Aliased {
  plain: i32 = 0;
  aliased: u32 @abi.alias("ts_alias") = 0;
  twice: f32 @abi.alias("first") @abi.alias("second") = 0;
  argless: i16 @abi.alias = 0;
}

@unmanaged class Explicit {
  aliased: u32 @abi.alias("via_class") = 0;
}

// --- fixed: the alias is returned -------------------------------------------
assert(abiNameOf<Aliased>("aliased") == "ts_alias");

// --- no alias: the TypeScript name ------------------------------------------
assert(abiNameOf<Aliased>("plain") == "plain");

// --- two aliases: the first is canonical ------------------------------------
assert(abiNameOf<Aliased>("twice") == "first");
assert(abiNameOf<Aliased>("twice") != "second");

// --- an argument-less @abi.alias falls back to the declared name ------------
// A named attribute with no usable argument must not become the empty string:
// the far side of an ABI needs a name, and the declared one is the truth.
assert(abiNameOf<Aliased>("argless") == "argless");

// --- the alias is not restricted to the `struct` keyword --------------------
assert(abiNameOf<Explicit>("aliased") == "via_class");

// --- and it never moves the layout -----------------------------------------
assert(offsetof<Aliased>("plain") == 0);
assert(offsetof<Aliased>("aliased") == 4);
assert(offsetof<Aliased>("twice") == 8);
assert(offsetof<Aliased>("argless") == 12);
assert(sizeof<Aliased>() == 16);   // 4+4+4+2, rounded to the u32 alignment (4)

// --- abiNameOf is compile-time: no runtime lookup is emitted ---------------
// (The .release.wat fixture is the evidence: the bodies are constants.)

export function run(): i32 {
  return offsetof<Aliased>("argless");
}
