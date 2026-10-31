// Use-site `@unmanaged` over an inline type — every refused cell.
//
// The parameter form is legal (`view-param.ts`). These are the positions where
// the use cannot supply an address, plus the one boundary where supplying one
// would be the wrong contract. Each is refused by name; none compiles.
//
// Every function below has a call site, because an unreferenced function is
// never resolved and would pass silently — measured while designing this phase.

struct View {
  a: u32 = 0;
  b: u32 = 0;
}

// A **return** type: the callee's frame is gone when the caller reads, so the
// view would dangle. (R3: deferred to a later phase with its own ruling.)
function returnsView(p: usize): @unmanaged View {
  return changetype<@unmanaged View>(p);
}
export function useReturnsView(p: usize): u32 {
  return returnsView(p).a;
}

// `@managed` over an inline type: a view is not GC-owned at any position.
function managedParam(v: @managed View): u32 {
  return v.a;
}
export function useManagedParam(p: usize): u32 {
  return managedParam(changetype<@unmanaged View>(p));
}

// A **local value** passed where a view is wanted: the value has no address.
function takesView(v: @unmanaged View): u32 {
  return v.a;
}
export function useLocalValue(): u32 {
  const t = new View();
  return takesView(t);
}

// A **host-visible** signature: the boundary emitters materialise a value for
// the host, and a view is an address this compiler never made (6411).
@external("env", "hostRead")
declare function hostRead(v: @unmanaged View): void;
export function useHostRead(p: usize): void {
  hostRead(changetype<@unmanaged View>(p));
}
