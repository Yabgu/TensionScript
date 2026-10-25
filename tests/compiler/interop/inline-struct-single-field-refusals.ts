// A **single-field** `@inline struct` at a host boundary — refused by name.
//
// This is the one shape where the C/WASM tool convention and this compiler
// disagree **invisibly**. BasicCABI passes a struct whose only member is a scalar
// as that scalar; this compiler passes records as pointers. Both are
// `(param i32)`, so a C module and a TensionScript module link cleanly, and then
// one of them reads an address as a number (or a number as an address). Nothing
// in the type system can tell the two apart, which is exactly why it is refused
// rather than shipped under one reading.
//
// Measured before refusing (see the phase's pre-work): the `@external` case
// emitted `(import "env" "host_s" (func (param i32)))` and the call site passed
// `base + mark` — a pointer — with 16 bytes reserved and the field stored at
// `+0`. A host reading the serialized scalar would get the address; a host
// reading a pointer would work. One of them is wrong and neither can tell.
//
// The multi-field case uses the pointer on purpose: there is no scalar to
// confuse it with, and both the engine's adapter (`guest_read(ptr, len)`) and
// the tool convention's byval pointer agree on it.
//
// `inline-struct-single-field.ts` is the other half: the same record, inside the
// module, where no ABI is involved and the shape works.

@inline struct S {
  a: i32;
}

@external("env", "host_s")
declare function host_s(s: S): void;

export function take(s: S): void {}

export function run(): void {
  let s: S = new S();
  s.a = 1;
  host_s(s);
  take(s);
}
