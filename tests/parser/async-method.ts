// `async` on class members, and on a function inside a namespace.
//
// The modifier is accepted where TypeScript accepts it: on a method, after the
// access and `static` modifiers. What TypeScript refuses -- a field, an
// accessor, a constructor, `async` after `static` -- is refused here too and
// pinned in `async-errors.ts`.

class C {
  async plain(): void {
    await other();
  }
  static async statik(): void {}
  async generic<T>(): void {
    await other();
  }
  public async withAccess(): void {}
  async withBody(): i32 {
    return await value();
  }
}

namespace N {
  export async function inNamespace(): void {}
}

abstract class A {
  abstract plain(): void;
  async concrete(): void {
    await other();
  }
}
