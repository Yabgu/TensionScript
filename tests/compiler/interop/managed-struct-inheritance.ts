// `@managed struct` is final: inheritance is refused by name.
//
// A managed struct's fields sit at fixed offsets from its reference, and
// `sizeof` reports the record's extent. A subclass would place its own fields
// past that extent, so the number a `struct` field, a `COPY_STRUCT`, or a host
// declaration computed would be wrong for the derived value. The check is
// explicit (AS100 with the reason) rather than the generic "cannot extend a
// final class" the `Final` flag would also produce, because the author needs to
// know *why* this record is final.
//
// Three-way:
//   refuse  (before the check): `extends` on a managed struct was accepted at
//           parse time; the prototype is marked `Final`, so the only diagnostic
//           was the generic final-class error — which says nothing about fixed
//           offsets, and which a reader would try to work around with `@final`.
//   partial (the check keyed on `@unmanaged` instead of `@managed`): no error at
//           all, because a managed struct is not unmanaged; the subclass would
//           then lay out and silently move `sizeof`.
//   fixed:   this diagnostic, naming the reason.

@managed struct Base {
  a: i32 = 0;
}

@managed struct Sub extends Base {
  b: i32 = 0;
}

export function use(s: Sub): i32 { return s.b; }
