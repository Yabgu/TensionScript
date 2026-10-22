// `struct`: the deprecation warning is the 0.9.0 flip made audible.
//
// At 0.8.0 `struct` is the borrowed form. At 0.9.0 the same spelling becomes a
// managed C-layout reference type, so an unmarked 0.8.0 declaration would change
// meaning one release later with no diagnostic. The warning fires on the plain
// form only: `@unmanaged struct` is the spelling that survives the flip, so it
// must stay silent.

struct Warns {
  x: f32;
}

@unmanaged struct Silent {
  x: f32;
}

@inline struct Reserved {
  x: f32;
}
