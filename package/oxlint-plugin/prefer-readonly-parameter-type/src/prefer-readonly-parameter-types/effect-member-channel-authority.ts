/**
 * The one permitted authority: which user-code channel each collection member opens.
 *
 * @module
 */

/**
 * Member reaching no user code at all, reading and writing internal slots only.
 *
 * `Map.prototype.get` consults `[[MapData]]`, never a property of its receiver, so
 * no accessor and no coercion hook can observe the call.
 *
 * What the probe establishes is narrower than that sentence, and the gap is worth
 * stating. It installs an own `size` accessor and finds it untouched, which shows
 * these members do not read `size`; it does not enumerate every property, because the
 * receiver is a real `Map` or `Set` rather than a general trap, and a `Proxy` cannot
 * stand in for one since these members reject a receiver without the internal slot.
 * So the broad claim rests on the specification, and the probe guards against drift
 * in the one channel it watches.
 */
export const MEMBER_CHANNEL_INTERNAL_SLOT: unique symbol = Symbol(
  'collection member reads internal slots and reaches no user code',
);

/**
 * Member whose only user-code channel is own-index access on its own receiver.
 *
 * `Array.prototype.includes` performs `Get(receiver, "0")`, which runs an indexed
 * accessor if the caller installed one. That is the same channel `values[0]` opens,
 * and this rule already treats a plain indexed read as a pure read, so admitting
 * these members widens nothing: the assumption is pre-existing, not introduced here.
 *
 * "Own-index access" is wider than `Get` and `Set`, and an earlier version of this
 * comment named only those two, which made the channel look narrower than the members
 * in it. Measured against a fully trapped receiver: `indexOf`, `lastIndexOf`,
 * `unshift`, `copyWithin`, `reverse` and `shift` reach `has`, and `pop` and `shift`
 * reach `deleteProperty`. Every one of those is still inside the baseline, because the
 * baseline is what this rule accepts on a parameter, not what an implementation was
 * guessed to do: `0 in values` keeps a read-only offer, and `delete values[0]` reports
 * a plain mutation. `effect-member-channel-traps.unit.test.ts` derives that baseline
 * executably and fails any member reaching outside it.
 *
 * The assumption is worth naming, because it is load-bearing and unsound in the
 * exotic case. Measured: an accessor installed at index 0 that pushes during its
 * getter turns `includes` into a call that restructures its own receiver, taking a
 * one-element array to two. The identical getter fires for `values[0]`. So this
 * rule's model, everywhere and not only here, assumes caller-owned collections hold
 * ordinary data properties. This channel is exactly that assumption, made explicit.
 */
export const MEMBER_CHANNEL_RECEIVER_INDEX: unique symbol = Symbol(
  'collection member reaches user code only through own-index access',
);

/**
 * Member whose channel no probe has established, so it stays failing closed.
 *
 * Absence from the table is never a claim that a member dispatches, only that
 * nothing here has shown it does not.
 */
export const MEMBER_CHANNEL_UNPROVEN: unique symbol = Symbol(
  'collection member has no verified user-code channel',
);

/**
 * Which user-code channel one default-library collection member opens.
 */
export type MemberUserCodeChannel =
  | typeof MEMBER_CHANNEL_INTERNAL_SLOT
  | typeof MEMBER_CHANNEL_RECEIVER_INDEX;

/**
 * Default-library collection members whose user-code channel is verified, by owner.
 *
 * This is an authority, not a derivation, and it exists by the amendment in
 * `doc/decision/prefer-readonly-member-channel-authority.md`. Which channel a member
 * opens is a fact about ECMA-262 that no declaration exposes: `Map.get` touches no
 * property while `Array.slice` consults species, and even their return types do not
 * separate them, since `toReversed` and `with` build new arrays without species
 * while `flat` uses it.
 *
 * An earlier revision of this table claimed every listed member ran no user code.
 * That was false for the whole `Array` half and was caught by probing an
 * accessor-bearing receiver rather than by reading it back: `at`, `includes`,
 * `indexOf`, `lastIndexOf`, `toReversed`, `toSpliced`, `pop` and `copyWithin` all
 * invoke an indexed getter. Hence two channels rather than one flat set.
 *
 * Every entry is enforced by `effect-member-channel-authority.unit.test.ts`, which
 * probes a real engine per member and fails when a member reaches a channel wider
 * than the one claimed. That enforcement is the whole difference between this and
 * the unverified catalogs the audit removed, so an entry added without a passing
 * probe is a defect.
 *
 * Members absent from this table are not asserted to be narrow; they are simply
 * unproven and keep failing closed.
 */
const CHANNELS_BY_OWNER: Readonly<
  Record<string, Readonly<Record<string, MemberUserCodeChannel>>>
> = {
  Array: {
    at: MEMBER_CHANNEL_RECEIVER_INDEX,
    includes: MEMBER_CHANNEL_RECEIVER_INDEX,
    indexOf: MEMBER_CHANNEL_RECEIVER_INDEX,
    lastIndexOf: MEMBER_CHANNEL_RECEIVER_INDEX,
    with: MEMBER_CHANNEL_RECEIVER_INDEX,
    toReversed: MEMBER_CHANNEL_RECEIVER_INDEX,
    toSpliced: MEMBER_CHANNEL_RECEIVER_INDEX,
    push: MEMBER_CHANNEL_RECEIVER_INDEX,
    pop: MEMBER_CHANNEL_RECEIVER_INDEX,
    shift: MEMBER_CHANNEL_RECEIVER_INDEX,
    unshift: MEMBER_CHANNEL_RECEIVER_INDEX,
    fill: MEMBER_CHANNEL_RECEIVER_INDEX,
    copyWithin: MEMBER_CHANNEL_RECEIVER_INDEX,
    reverse: MEMBER_CHANNEL_RECEIVER_INDEX,
  },
  ReadonlyArray: {
    at: MEMBER_CHANNEL_RECEIVER_INDEX,
    includes: MEMBER_CHANNEL_RECEIVER_INDEX,
    indexOf: MEMBER_CHANNEL_RECEIVER_INDEX,
    lastIndexOf: MEMBER_CHANNEL_RECEIVER_INDEX,
    with: MEMBER_CHANNEL_RECEIVER_INDEX,
    toReversed: MEMBER_CHANNEL_RECEIVER_INDEX,
    toSpliced: MEMBER_CHANNEL_RECEIVER_INDEX,
  },
  Map: {
    get: MEMBER_CHANNEL_INTERNAL_SLOT,
    has: MEMBER_CHANNEL_INTERNAL_SLOT,
    set: MEMBER_CHANNEL_INTERNAL_SLOT,
    delete: MEMBER_CHANNEL_INTERNAL_SLOT,
    clear: MEMBER_CHANNEL_INTERNAL_SLOT,
  },
  ReadonlyMap: {
    get: MEMBER_CHANNEL_INTERNAL_SLOT,
    has: MEMBER_CHANNEL_INTERNAL_SLOT,
  },
  Set: {
    has: MEMBER_CHANNEL_INTERNAL_SLOT,
    add: MEMBER_CHANNEL_INTERNAL_SLOT,
    delete: MEMBER_CHANNEL_INTERNAL_SLOT,
    clear: MEMBER_CHANNEL_INTERNAL_SLOT,
  },
  ReadonlySet: {
    has: MEMBER_CHANNEL_INTERNAL_SLOT,
  },
};

/**
 * Verified channels indexed for lookup, keyed by declaring interface then member.
 */
export const MEMBER_CHANNELS_BY_INTERFACE: ReadonlyMap<
  string,
  ReadonlyMap<string, MemberUserCodeChannel>
> = new Map(Object.entries(CHANNELS_BY_OWNER,)
  .map(function ownerChannels(
    [ownerName, members,],
  ): readonly [
    string,
    ReadonlyMap<string, MemberUserCodeChannel>,
  ] {
    return [
      ownerName,
      new Map(Object.entries(members,),),
    ];
  },),);

/**
 * Total verified entries, pinned so silent table growth fails the guard.
 *
 * The `catalog-free effect architecture` guard asserts this equals the summed entry
 * count. Adding a member therefore cannot pass unnoticed: the author must change
 * this number, which is the point at which the decision document and the probe
 * requirement are unavoidable.
 */
export const VERIFIED_MEMBER_CHANNEL_COUNT = 33;

/**
 * Iterator members deliberately absent, because their effects are deferred.
 *
 * `keys`, `values` and `entries` return an iterator, and creating one reaches
 * nothing. Advancing it reads the receiver, and for an array that read runs an
 * indexed accessor, so an inert-creation claim would be read as an inert-consumption
 * claim. Measured: `Array.prototype.values` fires no hook until `next()`, which
 * fires the indexed getter. Nothing here separates the two operations, so both stay
 * unproven.
 */
export const DEFERRED_MEMBER_NAMES: ReadonlySet<string> = new Set([
  'keys',
  'values',
  'entries',
],);

/**
 * Resolves which user-code channel a collection member is verified to open.
 *
 * @param ownerName - Declaring default-library interface name.
 *
 * @param memberName - Member being called.
 *
 * @returns verified channel, or the unproven sentinel.
 *
 * @example
 * ```ts
 * collectionMemberUserCodeChannel({ ownerName: 'ReadonlyMap', memberName: 'get' });
 * ```
 */
export function collectionMemberUserCodeChannel({
  ownerName,
  memberName,
}: {
  readonly ownerName: string;
  readonly memberName: string;
},): MemberUserCodeChannel | typeof MEMBER_CHANNEL_UNPROVEN {
  return MEMBER_CHANNELS_BY_INTERFACE.get(ownerName,)
    ?.get(memberName,)
    ?? MEMBER_CHANNEL_UNPROVEN;
}
