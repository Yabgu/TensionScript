// A **single-field** `@inline struct`: usable in the module, refused at a host
// boundary — two different answers to two different questions.
//
// **Inside the module it works now.** It did not before this commit: the
// parameter binding, `paramRefs` and `expandSroaArgument` all keyed their
// "unpack into fields" decision on `wasmParamCountOf(...) > 1`, and a one-field
// record spends exactly **one** WASM slot. So the parameter was bound as an
// ordinary local of the record type (with `toRef()`'s GC heap type), `paramRefs`
// emitted that heap type, and the caller compiled the argument as a whole value
// — the refusal. Every one-field value-type parameter was unusable, at every
// position. All three sites now key on the *type*, not on the slot count.
//
// **At a host boundary it is refused**, because the two conventions disagree in
// a way neither side can detect. The C/WASM tool convention (BasicCABI) passes a
// struct whose only member is a scalar **as that scalar**; this compiler passes
// records as pointers. Both are `(param i32)`. A C module and this compiler link
// cleanly and then read an address as a number. That is refused by name in
// `inline-struct-single-field-refusals.ts`; the fix is a deliberate flatten
// special case, not a nudge to the temp.
//
// Arithmetic: `addOne(S{5}) == 6`, `sumFields(S{7}, T{2,3}) == 12`.

@inline struct S {
  a: i32;
}

@inline struct T {
  b: i32;
  c: i32;
}

function addOne(s: S): i32 {
  return s.a + 1;
}

// A one-field record beside a two-field one: the two parameter shapes coexist.
function sumFields(s: S, t: T): i32 {
  return s.a + t.b + t.c;
}

// A one-field record as the **return** type too: sret does not care how many
// fields a record has, so this is the same mechanism with a one-field slot.
function make(n: i32): S {
  let s: S = new S();
  s.a = n;
  return s;
}

export function run(): i32 {
  let s: S = new S();
  s.a = 5;
  let t: T = new T();
  t.b = 2;
  t.c = 3;
  return addOne(s) + sumFields(s, t) + make(9).a;
}

// The assertions use locals: a value has no address, so only a local can cross
// a parameter boundary — the same rule a two-field record follows.
{
  let five = make(5);
  assert(addOne(five) == 6);
  let seven: S = new S();
  seven.a = 7;
  let pair: T = new T();
  pair.b = 2;
  pair.c = 3;
  assert(sumFields(seven, pair) == 12);
  assert(make(9).a == 9);
  assert(run() == 6 + 10 + 9);
}
