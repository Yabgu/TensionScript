// A linear record may not hold a GC reference (GC25).
//
// `@unmanaged` means "a C record with the layout I declared". Under the GC ABI a
// reference has no place in one: it is a pointer the engine traces, and the record's
// layout is the C declaration's. This is the second half of the partition's invariant,
// and it is the half that must keep refusing even though the record is exempt — an
// exempt record with a reference in it would hand the collector a pointer it cannot see
// and a layout the C side cannot describe.
//
// Flag-off both are legal (a `string` is a pointer there, and the record is still
// 8 bytes with it), which is why this is a *flag* restriction and not a language one.

@unmanaged class BadRecord {
  label: string = "";
  weight: f32 = 0;
}

export function probe(): i32 {
  let r = new BadRecord();
  r.label = "xy";
  r.weight = 40;
  return r.label.length + <i32>r.weight; // 42
}
