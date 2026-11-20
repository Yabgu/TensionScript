/**
 * A mask over executor ids: the contract, and the template that implements it.
 *
 * **The width is not in the ABI.** Nothing in the runtime counts bits: a mask
 * is a reference to a `MaskBase`, and the two seams that consult it (admission
 * in `~lib/thread`, the park in `~lib/task-stack`) ask it two questions — does
 * it allow this id, and how many ids can it name — and nothing else. The old
 * `i32` mask fixed the ceiling at 32 executors; that ceiling was *entirely*
 * ABI, so it is gone: a program picks a width by instantiating the template,
 * and a program that picks its own representation subclasses `MaskBase`.
 *
 * **`bits == 0` is unconstrained**, not "nothing allowed". The default value of
 * `TaskBase.mask` is `null`, which is unconstrained too, so a program that
 * never names a mask is never refused. This is the case people get wrong, and
 * it is why `union` special-cases zero below.
 *
 * This file imports nothing on purpose: `~lib/task` and `~lib/thread` both
 * import it, and a dependency either way would be a cycle whose initialisation
 * order decides the layout of a task.
 *
 * `docs/thread-abi.md` §7 is the contract.
 */

/**
 * What the runtime knows about a mask: two questions, no width constant.
 *
 * A program may implement this over any representation — (l) in
 * `tests/rt/gate4.js` is a hand-rolled 64-bit mask in two `u32` words — and the
 * runtime will place work under it, because the only thing it ever does with a
 * mask is ask these two questions.
 */
export abstract class MaskBase {
  /** Does this mask allow executor `id`? */
  abstract allows(id: i32): bool;
  /**
   * How many executor ids this mask can name: ids `0 .. width - 1`.
   *
   * The seams use it to tell "forbidden" from "the mask has no opinion", which
   * `allows` alone cannot say — an id the mask cannot name is not a refusal it
   * ever made. See the admission/park asymmetry in `docs/thread-abi.md` §7.3.
   */
  abstract get width(): i32;
}

/**
 * A mask over executor ids, `T` bits wide — `Mask<u32>` for 32 executors,
 * `Mask<u64>` for 64.
 *
 * **`bits == 0` is unconstrained**: every id is allowed, including ids the type
 * cannot name. An id the type *cannot* name (`>= width`, or negative) is also
 * allowed by `allows`, and the reason is measured: wasm's shift count is taken
 * mod the operand width, so computing `1 << id` past the width wraps to a bit
 * the program never set. Answering `false` there would forbid an executor the
 * program meant to allow; answering `true` says exactly what is true — this
 * mask has no opinion about that id. The two seams decide what to do about it
 * (admission refuses, the park counts nothing); that decision is theirs, not
 * the mask's.
 *
 * A **class**, not a generic function: generic functions do not parse on this
 * fork (`TS1003 Identifier expected`), measured. `new Mask<u64>(0)` is the
 * unconstrained value — there is no static factory, because `Mask<u64>.none()`
 * does not parse either (`TS1109`, measured).
 */
export class Mask<T> extends MaskBase {
  /** Bit `i` set = executor `i` allowed; `0` = unconstrained. */
  bits: T;

  constructor(bits: T) {
    super();
    this.bits = bits;
  }

  /** `sizeof<T>() * 8`: how many executor ids this instantiation can name. */
  get width(): i32 {
    return sizeof<T>() * 8;
  }

  /** Whether this mask allows executor `id`; `0` bits allows everything. */
  allows(id: i32): bool {
    if (this.bits == 0) return true;
    if (id < 0 || id >= this.width) return true;
    return (this.bits & (<T>1 << <T>id)) != 0;
  }

  /**
   * The same mask with executor `id` also allowed.
   *
   * An id this instantiation cannot name changes nothing: there is no bit to
   * set, and wrapping the shift would set a bit for a *different* executor.
   *
   * Note this is bit insertion, not constraint relaxation: on an unconstrained
   * mask (`bits == 0`) the result is constrained, because `0 | bit` is `bit`.
   * `union` is the operation that keeps unconstrained absorbing; `with` is how
   * a program builds a set.
   */
  with(id: i32): Mask<T> {
    if (id < 0 || id >= this.width) return new Mask<T>(this.bits);
    return new Mask<T>(this.bits | (<T>1 << <T>id));
  }

  /**
   * The union of two masks.
   *
   * **`0` absorbs**: unconstrained unioned with anything is still
   * unconstrained. Plain `a | b` would silently narrow `0 | {1}` to `{1}`,
   * which forbids 62 executors the program never meant to forbid.
   */
  union(other: Mask<T>): Mask<T> {
    if (this.bits == 0 || other.bits == 0) return new Mask<T>(0);
    return new Mask<T>(this.bits | other.bits);
  }
}
