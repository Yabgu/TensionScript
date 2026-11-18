// The editor's undo dispatch, reduced: two classes with **identical layouts**
// whose only difference is which command they are.
//
// `tension-framework/assembly/editor/command.ts:220,259` do exactly this
// (`next instanceof SetX` / `next instanceof SetY`), and under structural wasm GC
// typing `SetX` and `SetY` canonicalize into one type — so `ref.test` answers
// true for both and the editor silently applies the wrong command.
//
// The brand field is what makes this work: it is a *value* compared at run time,
// not a type test against one type.
class Command { }

class SetX extends Command {
  id: i32;
  value: f32;
  constructor(id: i32, value: f32) { super(); this.id = id; this.value = value; }
}

class SetY extends Command {
  id: i32;
  value: f32;
  constructor(id: i32, value: f32) { super(); this.id = id; this.value = value; }
}

export function makeX(): Command { return new SetX(1, 2.0); }
export function makeY(): Command { return new SetY(3, 4.0); }

export function isCommand(v: Command): bool { return v instanceof Command; }
export function isX(v: Command): bool { return v instanceof SetX; }
export function isY(v: Command): bool { return v instanceof SetY; }

/** Bit 1: isCommand(x) · 2: isX(x) · 4: isY(x) · 8: isY(y) · 16: isX(y). */
export function probe(): i32 {
  let x = makeX();
  let y = makeY();
  let acc = 0;
  if (isCommand(x)) acc += 1;
  if (isX(x)) acc += 2;
  if (isY(x)) acc += 4;
  if (isY(y)) acc += 8;
  if (isX(y)) acc += 16;
  return acc;
}

/** The fields still read correctly through the base type. */
export function idOf(v: Command): i32 {
  if (v instanceof SetX) return (<SetX>v).id;
  if (v instanceof SetY) return (<SetY>v).id;
  return -1;
}
