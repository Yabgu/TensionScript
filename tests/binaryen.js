// The vendored Binaryen: is the stack-switching C API reachable from the glue the
// compiler actually imports?
//
// Why this exists. Every other test in this tree runs the compiler, and the compiler
// runs perfectly well against a Binaryen that has no `cont.new` constructor at all —
// nothing in the current language emits one. So "the fixtures pass" says nothing
// about the thing this dependency was vendored for, and a build script that quietly
// produced a stock Binaryen would pass every gate in the suite.
//
// Three assertions, and the third is the one that keeps the first two honest:
//
//   1. The six constructors are functions **on the module `lib/binaryen.js`
//      resolves to** — the same specifier `src/glue/binaryen.js` uses, resolved the
//      same way, so this cannot pass while the compiler sees something else.
//   2. `Features.StackSwitching` is the flag the compiler sets, and it is the value
//      Binaryen 131 has (1 << 16).
//   3. A module built through those functions validates. Presence is not
//      sufficiency: a constructor wired to the wrong builder returns a *function*
//      too. This builds `cont.new`/`resume` with a handler clause and asks
//      Binaryen's own validator, which is the cheapest way to notice.
//
// What it deliberately does not do is emit and run the module — `tests/gc` covers
// executing emitted code, and the round that needed an engine was a spike, not a
// gate.

import binaryen from "../lib/binaryen.js";

import { stdoutColors } from "../util/terminal.js";

let checks = 0;
let failures = 0;

function check(description, actual, expected) {
  checks++;
  if (actual === expected) {
    console.log("ok      " + description);
  } else {
    failures++;
    console.log("not ok  " + description);
    console.log("          expected: " + expected);
    console.log("          actual  : " + actual);
  }
}

// 1. The six functions, on the object the compiler imports.
for (const name of [
  "_BinaryenContNew",
  "_BinaryenSuspend",
  "_BinaryenResume",
  "_BinaryenResumeWithHandlers",
  "_BinaryenResumeThrow",
  "_TypeBuilderSetContinuation",
]) {
  check(name + " is exported by lib/binaryen.js", typeof binaryen[name], "function");
}

// 2. The feature bit the compiler has to set for `(cont $ft)` to be written as
//    `5d 00` rather than the generalized `5d 70`.
check("Features.StackSwitching is 1 << 16", binaryen.Features.StackSwitching, 65536);

// 3. A module built only through those functions validates.
{
  const module = new binaryen.Module();
  // GC must be in the mask for the writer to keep the continuation's heap type; the
  // validator is what would notice if it did not, but only after the *emit*, so the
  // flag is set here for the same reason `src/module.ts` sets it.
  module.setFeatures(
    binaryen.Features.StackSwitching |
      binaryen.Features.ReferenceTypes |
      binaryen.Features.ExceptionHandling |
      binaryen.Features.GC
  );

  const builder = new binaryen.TypeBuilder(2);
  builder.setSignatureType(0, binaryen.none, binaryen.none);
  const funcType = builder.getTempHeapType(0);
  builder.setContinuation(1, funcType);
  const [ftHeap, ctHeap] = builder.buildAndDispose();
  const ctRef = binaryen._BinaryenTypeFromHeapType(ctHeap, true);

  module.addTag("yield", binaryen.none, binaryen.none);
  module.addFunction("body", binaryen.none, binaryen.none, [], module.suspend("yield", []));
  module.addPassiveElementSegment("declare", ["body"]);

  // (block $parked (result (ref null $ct))
  //   (resume $ct (on $yield $parked) (cont.new $ct (ref.func $body)))
  //   (unreachable))
  //
  // The `unreachable` is what gives the block its `(ref null $ct)`: the handler
  // label receives the continuation, while the fall-through path does not exist —
  // a `resume` that returns normally has finished, and this program never does.
  const parked = module.block("parked", [
    module.resume_with_handlers(
      module.cont.new(ctHeap, module.ref.func("body", ftHeap)),
      ctHeap, ["yield"], ["parked"]),
    module.unreachable(),
  ], ctRef);
  // The `resume` yields the parked continuation; dropping it keeps `go` `() -> ()`
  // and the program minimal. What the module is *for* is that these three
  // constructors exist and compose, not that the continuation is used.
  module.addFunction("go", binaryen.none, binaryen.none, [],
    module.block(null, [module.drop(parked)], binaryen.none));
  module.addFunctionExport("go", "go");

  // `validate()` answers the C API's int, not a boolean — `src/module.ts` compares
  // `== 1` for the same reason.
  check("a module using cont.new/resume(with handler)/suspend validates",
    module.validate(), 1);

  // The type section, as bytes: `5d 00` is `(cont $ft)`, `5d 70` is the
  // generalized funcref Binaryen writes when GC is off the feature mask.
  const bytes = Buffer.from(module.emitBinary());
  check("the continuation type is written canonically (5d 00, and no 5d 70)",
    bytes.includes(Buffer.from([0x5d, 0x00])) &&
      !bytes.includes(Buffer.from([0x5d, 0x70])), true);
  module.dispose();
}

console.log();
if (failures) {
  process.exitCode = 1;
  console.log(stdoutColors.red("ERROR: ") + failures + " of " + checks + " vendor checks failed");
} else {
  console.log("[ " + stdoutColors.white("SUCCESS") + " ] " + checks + " checks");
}
