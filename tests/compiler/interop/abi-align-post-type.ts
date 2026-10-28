// `@abi.align(N)` written *after* the type, and why it is refused by name.
//
// The prefix spelling (`@abi.align(16) b: u32`) puts the attribute on the field
// declaration, which is the only place that has a slot to align. Written after
// the type (`b: u32 @abi.align(16)`) it would attach to the **type node**, and
// a type node travels: into a parameter, a local, a return type — positions
// with no storage of their own. Accepted there it would be parsed and silently
// ignored, which is the same trap the neighbouring `@inline`/`@lazy` refusals
// close, so it gets the same shape of refusal.
//
// This is a parse error, so it aborts before resolution; that is why it is its
// own fixture rather than one case among `interop/abi-align-refusals`.

@unmanaged struct PostType {
  a: u32 @abi.align(16);
}

export function run(): i32 {
  return offsetof<PostType>("a");
}
