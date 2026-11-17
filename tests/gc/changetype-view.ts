// The guarantee the whole design rests on: **a GC reference cannot be smuggled into
// a blob.**
//
// A byte buffer holds no GC references — that is why its storage may stay in linear
// memory and be addressable. The only way to break that would be to put a *reference*
// into the blob, and the only way to do that would be to turn a reference into an
// address: `changetype<usize>(aGCReference)`. That is refused by name (AS100), and
// this file is the test that keeps it refused.
//
// A `TypedArray` view is now itself a GC struct (GC16), so it is exactly the object
// most likely to tempt someone into `changetype<usize>(view)` — "the data is right
// there". It is not: the data is at `view.dataStart`, which is an `i32` field, and
// the view object is a handle whose address does not exist.
export function viewAddress(): usize {
  let a = new Uint8Array(4);
  return changetype<usize>(a);
}
