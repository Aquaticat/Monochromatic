/**
 * The one permitted authority: collection members verified to run no user code.
 *
 * @module
 */

/**
 * Default-library collection members that consult no `Symbol.species` and coerce
 * no element, keyed by the interface declaring them.
 *
 * This is an authority, not a derivation, and it exists by the amendment in
 * `doc/decision/prefer-readonly-inert-member-authority.md`. Whether a member runs
 * user code is a fact about ECMA-262 that no declaration exposes: `Map.get` runs
 * nothing while `Array.slice` consults species, and even their return types do not
 * separate them, since `toReversed` and `with` build new arrays without species
 * while `flat` uses it.
 *
 * Every entry is enforced by `effect-inert-member-authority.unit.test.ts`, which
 * probes a real engine per member and fails when a listed member dispatches. That
 * enforcement is the whole difference between this and the unverified catalogs the
 * audit removed, so an entry added without a passing probe is a defect.
 *
 * Members absent from this table are not asserted to dispatch; they are simply
 * unproven and keep failing closed.
 */
export const INERT_MEMBERS_BY_INTERFACE: ReadonlyMap<string, ReadonlySet<string>> =
  new Map([
    [
      'Array',
      new Set([
        'at',
        'includes',
        'indexOf',
        'lastIndexOf',
        'with',
        'toReversed',
        'toSpliced',
        'keys',
        'values',
        'entries',
        'push',
        'pop',
        'shift',
        'unshift',
        'fill',
        'copyWithin',
        'reverse',
      ],),
    ],
    [
      'ReadonlyArray',
      new Set([
        'at',
        'includes',
        'indexOf',
        'lastIndexOf',
        'with',
        'toReversed',
        'toSpliced',
        'keys',
        'values',
        'entries',
      ],),
    ],
    [
      'Map',
      new Set([
        'get',
        'has',
        'set',
        'delete',
        'clear',
        'keys',
        'values',
        'entries',
      ],),
    ],
    [
      'ReadonlyMap',
      new Set([
        'get',
        'has',
        'keys',
        'values',
        'entries',
      ],),
    ],
    [
      'Set',
      new Set([
        'has',
        'add',
        'delete',
        'clear',
        'keys',
        'values',
        'entries',
      ],),
    ],
    [
      'ReadonlySet',
      new Set([
        'has',
        'keys',
        'values',
        'entries',
      ],),
    ],
  ],);

/**
 * Tests whether a member is verified to run no user code.
 *
 * @param ownerName - Declaring default-library interface name.
 *
 * @param memberName - Member being called.
 *
 * @returns whether the member is a verified inert operation.
 *
 * @example
 * ```ts
 * isInertCollectionMember({ ownerName: 'ReadonlyMap', memberName: 'get' });
 * ```
 */
export function isInertCollectionMember({
  ownerName,
  memberName,
}: {
  readonly ownerName: string;
  readonly memberName: string;
},): boolean {
  return INERT_MEMBERS_BY_INTERFACE.get(ownerName,)
    ?.has(memberName,)
    ?? false;
}
