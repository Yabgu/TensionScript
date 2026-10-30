// Use-site `@unmanaged` over an inline type — the **parameter** form.
//
// `View` is a plain struct (an `@inline` value: one WASM local per field). A
// parameter declared `v: @unmanaged View` is a *view*: the caller supplies an
// address, and the callee reads through it. The declaration still says value —
// every use of `View` shares one `Type` — which is why `v.a` resolves at all;
// what changed is the storage, recorded as the parameter's memory model.
//
// The two reads below are the whole feature at this phase:
//   - `read` takes one `i32` (the pointer), NOT one operand per field;
//   - each `v.<field>` is a load at the field's offset.
//
// The address comes from `changetype<@unmanaged View>(ptr)` (Phase 1), which is
// the only expression that produces one for an inline type. A local *value*
// cannot be passed here: it has no address to lend, and that refusal is in
// `view-param-refusals.ts`.

struct View {
  a: u32 = 0;
  b: u32 = 0;
  c: f32 = 0;
}

function read(v: @unmanaged View): u32 {
  return v.a + v.b + u32(v.c);
}

export function through(ptr: usize): u32 {
  return read(changetype<@unmanaged View>(ptr));
}
