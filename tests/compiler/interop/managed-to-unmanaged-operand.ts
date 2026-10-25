// `@managed` → `@unmanaged` at a call operand: the pointer crosses, and the
// shadow stack still roots the object.
//
// The cell is "free" in codegen — both models are one `i32` pointing at the same
// record — but not in *lifetime*: the object is GC-managed, only the view is
// unmanaged. `operandsTostack` roots a call operand when the callee's parameter
// type is managed, so an `@unmanaged` parameter used to root nothing:
//
//   before: call $makeM; call $take — no frame, no slot, no store. A collection
//           inside `take` (or anything it calls) could reclaim the record while
//           `take` still held the pointer.
//   fixed:  frame, slot, store, then the call — the same shape a managed
//           parameter produces.
//
// This is the assertion the fixture pins: the caller has a shadow-stack frame
// and writes the pointer into it before the call. It is the only shape in the
// tree that does, and it is why `npm test` is otherwise byte-identical.

@managed struct Record_ {
  a: i32;
  b: i32;
}

@unmanaged struct View {
  a: i32;
  b: i32;
}

function makeRecord(): Record_ {
  let record = new Record_();
  record.a = 20;
  record.b = 22;
  return record;
}

function readThroughView(view: View): i32 {
  return view.a + view.b;
}

// The operand is a managed temporary: this is the shape that was unrooted.
export function sumTemporary(): i32 {
  return readThroughView(changetype<View>(makeRecord()));
}

// A named local is rooted by its own frame slot for the whole function, so this
// shape was already safe — the fixture pins that it still is.
export function sumLocal(): i32 {
  let record = makeRecord();
  let view = changetype<View>(record);
  return readThroughView(view) + record.a;
}

// The same record under an explicit use-site model: the override does not change
// the resolved type (still `Record_`, still managed), so the assignment is an
// identity conversion and the parameter is rooted as a managed one.
export function sumOverride(record: Record_): i32 {
  let view: @unmanaged Record_ = record;
  return readThroughView(changetype<View>(view)) + view.b;
}
