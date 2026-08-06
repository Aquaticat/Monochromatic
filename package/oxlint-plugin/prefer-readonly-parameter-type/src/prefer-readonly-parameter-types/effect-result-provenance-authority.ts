/**
 * Where a collection member's result came from, for members verified by probe.
 *
 * Separate from `effect-member-channel-authority.ts` on purpose. That table proves
 * which user-code channels run during a call; this one proves where the returned
 * value came from. They are independent facts: `Array.prototype.join` reaches user
 * code and returns nothing of the receiver, while `Array.prototype.at` reaches the
 * same indexed channel and returns the receiver's own element. Neither answer
 * implies the other, so neither table may be read as evidence for the other.
 *
 * @module
 */

/**
 * Result is identically a value the receiver held, not a copy of one.
 *
 * `Map.prototype.get` hands back the stored value itself, so mutating the result
 * mutates what the receiver holds. Established by identity comparison against a
 * sentinel placed in the receiver, never by return-type shape: a member returning
 * `T` may equally return a fresh `T`.
 */
export const RESULT_RELATION_RECEIVER_VALUE: unique symbol = Symbol(
  'collection member returns a value the receiver holds, by identity',
);

/**
 * Result relation no probe has established, so it stays failing closed.
 *
 * Absence from the table is never a claim that a result is fresh, only that
 * nothing here has shown it is receiver state.
 */
export const RESULT_RELATION_UNPROVEN: unique symbol = Symbol(
  'collection member has no verified result relation',
);

/**
 * Result is a freshly built container that may hold values the receiver holds.
 *
 * `values.filter(kept)` hands back a new array whose elements are the receiver's own, so
 * `copy[0].label = 'x'` reaches the receiver while `copy.push(row)` reaches nothing the
 * caller shared. Those are different answers about one value, which is why this is a
 * second relation rather than a wider reading of the first.
 *
 * "May hold" rather than "holds", deliberately. A predicate can reject every element, and
 * a member outside this increment can mix receiver elements with argument elements. The
 * relation therefore bounds what the result can carry and never asserts that it does.
 *
 * Established by a probe with two halves, since either alone is satisfied by the wrong
 * value: the result is not the receiver, and an element of the result is the sentinel the
 * receiver held.
 */
export const RESULT_RELATION_RECEIVER_ELEMENTS: unique symbol = Symbol(
  'collection member returns a fresh container that may hold receiver values',
);

/**
 * Which receiver-state relation one default-library member's result satisfies.
 */
export type MemberResultRelation =
  | typeof RESULT_RELATION_RECEIVER_VALUE
  | typeof RESULT_RELATION_RECEIVER_ELEMENTS;

/**
 * One verified result relation, with the receiver position its result comes from.
 *
 * The position matters and a bare relation would lose it. `Map<K, V>.get` returns
 * the `V` at position 1, and treating "any type argument of the receiver" as the
 * source would let a `Map<Labelled, string>` lookup claim its `string` result
 * aliases the `Labelled` key. Recording the position keeps the claim member-specific.
 */
export type MemberResultProvenance = {
  readonly relation: MemberResultRelation;
  readonly receiverTypeArgumentIndex: number;
};

/**
 * Members whose result provenance is verified, by declaring interface.
 *
 * This is an authority, and it exists under the same amendment that permits
 * `effect-member-channel-authority.ts`: which receiver value a member returns is a
 * fact about ECMA-262 that no declaration exposes. `at` and `slice` have return
 * types differing only in arity, and one aliases the receiver's element while the
 * other builds a fresh array holding the same elements.
 *
 * That distinction is the whole reason this table is narrow. A fresh container
 * holding receiver elements is not itself receiver state: crediting `values.slice()`
 * to `values` would attribute `copy.push(x)` to a caller's array that never saw it.
 * So only the direct-value relation is represented, and container results stay
 * unproven rather than being described by a second relation nothing needs yet.
 *
 * Every entry is enforced by `effect-result-provenance.unit.test.ts`, which places a
 * sentinel in a real receiver and compares result identity. An entry added without a
 * passing identity probe is a defect.
 */
const PROVENANCE_BY_OWNER: Readonly<
  Record<string, Readonly<Record<string, MemberResultProvenance>>>
> = {
  Array: {
    at: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    filter: {
      relation: RESULT_RELATION_RECEIVER_ELEMENTS,
      receiverTypeArgumentIndex: 0,
    },
    find: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    findLast: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    pop: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    shift: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    slice: {
      relation: RESULT_RELATION_RECEIVER_ELEMENTS,
      receiverTypeArgumentIndex: 0,
    },
  },
  ReadonlyArray: {
    at: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    filter: {
      relation: RESULT_RELATION_RECEIVER_ELEMENTS,
      receiverTypeArgumentIndex: 0,
    },
    find: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    findLast: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 0,
    },
    slice: {
      relation: RESULT_RELATION_RECEIVER_ELEMENTS,
      receiverTypeArgumentIndex: 0,
    },
  },
  Map: {
    get: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 1,
    },
  },
  ReadonlyMap: {
    get: {
      relation: RESULT_RELATION_RECEIVER_VALUE,
      receiverTypeArgumentIndex: 1,
    },
  },
};

/**
 * Verified result relations indexed for lookup, by interface then member.
 */
export const RESULT_PROVENANCE_BY_INTERFACE: ReadonlyMap<
  string,
  ReadonlyMap<string, MemberResultProvenance>
> = new Map(Object.entries(PROVENANCE_BY_OWNER,)
  .map(function ownerProvenance(
    [ownerName, members,],
  ): readonly [
    string,
    ReadonlyMap<string, MemberResultProvenance>,
  ] {
    return [
      ownerName,
      new Map(Object.entries(members,),),
    ];
  },),);

/**
 * Total verified entries, pinned so silent table growth fails the guard.
 *
 * A literal in the architecture guard must match this. Adding a member therefore
 * cannot pass unnoticed: the author must change a number in a second file, which is
 * the point at which the identity probe becomes unavoidable.
 */
export const VERIFIED_RESULT_RELATION_COUNT = 14;

/**
 * Fresh-container members still absent, each for a reason of its own.
 *
 * `slice` and `filter` left this list when the container relation arrived. The rest stay,
 * and not merely because nobody got to them:
 *
 * - `concat`, `with` and `toSpliced` mix receiver elements with argument elements, so
 *   `rows.with(0, replacement)` can hand back a container whose written element came from
 *   the argument. The relation would have to union two sources, and the probe would have to
 *   record that it is non-exclusive.
 * - `flat` returns descendants rather than the receiver's immediate held type:
 *   `readonly (readonly Row[])[]` flattens to `Row[]`, so the type argument this authority
 *   records names the wrong level, and greater depths reach further.
 * - `concat` additionally consults `Symbol.isConcatSpreadable` and traverses its arguments,
 *   which is a channel the stated trust baseline does not cover.
 * - `toReversed` is uniform and would likely qualify, and is held back only to keep the
 *   first container increment to members whose probe shape is already proven.
 *
 * Their exclusion is asserted, so removing one without adding its relation fails a test.
 */
export const FRESH_CONTAINER_MEMBER_NAMES: ReadonlySet<string> = new Set([
  'concat',
  'toReversed',
  'toSpliced',
  'with',
  'flat',
],);

/**
 * Resolves which result relation a collection member is verified to satisfy.
 *
 * @param ownerName - Declaring default-library interface name.
 *
 * @param memberName - Member being called.
 *
 * @returns verified provenance, or the unproven sentinel.
 *
 * @example
 * ```ts
 * memberResultProvenance({ ownerName: 'ReadonlyMap', memberName: 'get' });
 * ```
 */
export function memberResultProvenance({
  ownerName,
  memberName,
}: {
  readonly ownerName: string;
  readonly memberName: string;
},): MemberResultProvenance | typeof RESULT_RELATION_UNPROVEN {
  return RESULT_PROVENANCE_BY_INTERFACE.get(ownerName,)
    ?.get(memberName,)
    ?? RESULT_RELATION_UNPROVEN;
}
