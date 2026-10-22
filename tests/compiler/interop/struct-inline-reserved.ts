// `@inline struct` is refused by name: value types are the 1.0 feature, and the
// reservation must not parse-and-ignore (the @fieldOffset lesson). AS100
// ("Not implemented"), not AS212 ("decorator not valid here") -- the author
// wrote the reserved form deliberately, and "misplaced" would be the wrong
// story.
//
// The contrasting case is checked in the same run: `@inline` on a *class* is a
// genuinely misplaced decorator and keeps AS212.

@inline struct Value {
  x: f32;
}

@inline class Misplaced {
  x: f32;
}

export function run(): i32 { return 0; }
