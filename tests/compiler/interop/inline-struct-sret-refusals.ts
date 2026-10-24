// `@inline struct` returns — every use that is still refused, each by name.
//
// Sret implements the **in-module, direct-call** shape: the caller allocates a
// slot and passes its address as the hidden first parameter. Every other route
// into the callee would have to produce that parameter out of nowhere, so each
// is refused with a diagnostic that says which route it was:
//
//   1. an export — the host has no way to pass a destination pointer. That is an
//      ABI version, not a codegen choice.
//   2. an import (`@external`) — the same boundary in the other direction: the
//      host would have to write the value into a slot it has never heard of.
//   3. a function value — an indirect call reaches the callee through a
//      signature the caller only knows dynamically, and the destination is a
//      *parameter*, so it cannot be threaded.
//   4. a virtual method — the override stub forwards `this` and the source
//      parameters; its own signature has no destination to forward.
//   5. returning anything but a local — a value has no address, so an expression
//      would have to be materialised before the fields can be written, and the
//      only place to materialise it is a slot nobody allocated.
//
// Not refused, because it is implemented: a direct call in the module, read as
// `f().x` or copied with `let q: P = f()` — see `inline-struct-sret.ts`,
// `inline-struct-sret-combined.ts` and `inline-struct-sret-recursion.ts`.
//
// **Every case is reachable from `run()`**: a refusal that only fires while
// compiling a function is invisible in a dead one.

@inline struct P {
  x: i32;
  y: i32;
}

function make(n: i32): P {
  let p: P = new P();
  p.x = n;
  return p;
}

// 1. across the module boundary, outward
export function exported(): P {
  return make(1);
}

// 2. across the module boundary, inward
@external("env", "getP")
declare function imported(): P;

// 3. through a function value
function throughValue(): i32 {
  let g: (n: i32) => P = make;
  return g(1).x;
}

// 4. a virtual method
class Base {
  make(n: i32): P {
    let p: P = new P();
    p.x = n;
    return p;
  }
}

class Derived extends Base {
  make(n: i32): P {
    return make(n);
  }
}

// 5. returning a call rather than a local
function fromCall(n: i32): P {
  return make(n);
}

export function run(): i32 {
  throughValue();
  fromCall(1);
  let b: Base = new Derived();
  b.make(2);
  return 0;
}
