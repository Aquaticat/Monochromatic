/**
 * Read-only view membership for default-library interfaces the library never paired.
 *
 * @module
 */

/**
 * Members a read-only `DataView` would carry, by name.
 *
 * `collectionStructureClaim` derives "this member restructures its receiver" by diffing an
 * interface against its `Readonly` counterpart: `Array` has `push` and `ReadonlyArray` does
 * not, so `push` mutates. The derivation needs a pair, and the default library declares no
 * `ReadonlyDataView`, so every `DataView` member answered "unrecognized" and every buffer
 * write landed on the opaque boundary. Measured before this existed: 21 findings across the
 * workspace named a buffer member, 14 named nothing else, and `writeEndOfCentralDirectory`
 * in `package/module/zip-writer/src/serialize.ts` carried a `ForeignBorrowed` marker and a
 * hand-written `@mutates view` for what is a specification-defined store.
 *
 * Declaring the missing view rather than listing the mutators is deliberate. It reuses the
 * existing derivation unchanged instead of adding a second one that could disagree with it,
 * and it states the fact in the same shape the library states it for every paired interface.
 *
 * The reading members only, including the `Big` pair a later library file adds. Every `set`
 * member is absent, which is what makes them mutate.
 * `buffer`, `byteLength` and `byteOffset` are present because reading them changes nothing;
 * `buffer` hands out the underlying `ArrayBuffer`, which is an exposure question the result
 * relations answer and not a restructuring of the view.
 *
 * Enforced by `effect-unpaired-view.unit.test.ts`, which drives a real `DataView` and proves
 * each absent member changes what a present one returns, and that each present member does
 * not. An entry added without that probe is a defect by the same standard the other
 * authorities are held to.
 */
const DATA_VIEW_READONLY_MEMBERS: ReadonlySet<string> = new Set([
  'buffer',
  'byteLength',
  'byteOffset',
  'getBigInt64',
  'getBigUint64',
  'getFloat16',
  'getFloat32',
  'getFloat64',
  'getInt8',
  'getInt16',
  'getInt32',
  'getUint8',
  'getUint16',
  'getUint32',
],);

/**
 * Read-only view membership for every interface the default library leaves unpaired.
 */
const UNPAIRED_VIEW_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [
    'DataView',
    DATA_VIEW_READONLY_MEMBERS,
  ],
],);

/**
 * Total declared members across every unpaired interface, pinned against silent growth.
 *
 * A literal in the architecture guard must match this, so adding a member means changing a
 * number in a second file, which is where the probe becomes unavoidable.
 */
export const VERIFIED_UNPAIRED_VIEW_COUNT = 14;

/**
 * Sentinel for an interface this authority says nothing about.
 */
export const UNPAIRED_VIEW_UNKNOWN: unique symbol = Symbol(
  'default-library interface has no declared read-only view membership here',
);

/**
 * Reads the declared read-only membership for one unpaired interface.
 *
 * @param ownerName - Default-library interface owning the member.
 *
 * @returns member names a read-only view would carry, or sentinel when undeclared.
 *
 * @example
 * ```ts
 * unpairedViewMembers({ ownerName: 'DataView' });
 * ```
 */
export function unpairedViewMembers({
  ownerName,
}: {
  readonly ownerName: string;
},): ReadonlySet<string> | typeof UNPAIRED_VIEW_UNKNOWN {
  return UNPAIRED_VIEW_MEMBERS.get(ownerName,)
    ?? UNPAIRED_VIEW_UNKNOWN;
}

/**
 * Every interface this authority declares, for the architecture guard.
 */
export const UNPAIRED_VIEW_INTERFACES: ReadonlyMap<
  string,
  ReadonlySet<string>
> = UNPAIRED_VIEW_MEMBERS;
