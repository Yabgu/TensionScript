// An async shape the transform refuses reaches the compiler and is refused by
// name.
//
// The parser no longer diagnoses `async` at all (Phase 3, commit 7b): lowering
// and refusal both live in the `afterParse` transforms, so this fixture pins
// that a *refused* shape still stops the pipeline with a named `AS100` and
// emits no code, rather than walking a construct the compiler does not
// understand into codegen's unhandled-kind `assert(false)`.
//
// The shape is a static async method: `this` there is the class object, not a
// receiver parameter, so there is no value the resume function's this-struct
// could hold (async plan §4.8; closures plan §7.1a).

class NotYet {
  static async notYet(): void {}
}

export function main(): void {
  NotYet.notYet();
}
