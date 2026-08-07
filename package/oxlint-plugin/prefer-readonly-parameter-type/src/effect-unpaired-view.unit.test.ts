import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  UNPAIRED_VIEW_INTERFACES,
  VERIFIED_UNPAIRED_VIEW_COUNT,
} from '../dist/final/node/index.mjs';

/**
 * Bytes in the probe buffer, wide enough for the widest member this authority names.
 */
const PROBE_BYTE_LENGTH = 16;

/**
 * Value written by every mutating probe, distinct from the zeroed buffer.
 */
const PROBE_WRITE_VALUE = 1;

/**
 * Builds one zeroed view and a reader of its bytes.
 *
 * @returns view under probe and a snapshot function over its bytes.
 *
 * @example
 * ```ts
 * const { view, snapshot } = probeView();
 * ```
 */
function probeView(): {
  readonly view: DataView;
  readonly snapshot: () => string;
} {
  /**
   * Buffer the probe view reads and writes.
   */
  const buffer = new ArrayBuffer(PROBE_BYTE_LENGTH,);
  return {
    view: new DataView(buffer,),
    snapshot: (): string =>
      [
        ...new Uint8Array(buffer,),
      ]
        .join(',',),
  };
}

/**
 * Calls one member with arguments it accepts, ignoring what it returns.
 *
 * A property is read rather than called, which is the whole of what reading one does.
 * A member taking an offset takes zero, and a setter takes a value the zeroed buffer does
 * not already hold, so a member that writes provably changes the bytes.
 *
 * @param view - View under probe.
 *
 * @param memberName - Member being exercised.
 *
 * @example
 * ```ts
 * exerciseMember({ view, memberName: 'setUint8' });
 * ```
 */
function exerciseMember({
  view,
  memberName,
}: {
  readonly view: DataView;
  readonly memberName: string;
},): void {
  /**
   * Value the member holds, which for a property is the whole operation.
   */
  const held = (view as unknown as Record<string, unknown>)[memberName];
  if ((typeof held) !== 'function')
    return;
  /* A `Big` member rejects a number outright, so the written value has to match the member's
   * own domain or the probe fails on argument conversion rather than measuring anything. */
  const written = memberName.includes('Big',)
    ? 1n
    : PROBE_WRITE_VALUE;
  (held as (this: DataView, ...args: readonly unknown[]) => unknown)
    .apply(
      view,
      memberName.startsWith('set',)
        ? [0, written,]
        : [0,],
    );
}

await describe({
  name: 'unpaired read-only view membership',
  concurrency: 1,
  children: [
    it({
      name: 'keeps every declared member from changing the receiver, and every absent one changing it',
      fn: async () => {
        /**
         * Declared members that changed the bytes despite claiming to be read-only.
         */
        const wroteDespiteDeclared: string[] = [];
        /**
         * Absent members that changed nothing despite being treated as mutators.
         */
        const inertDespiteAbsent: string[] = [];
        for (const [ownerName, declared,] of UNPAIRED_VIEW_INTERFACES) {
          if (ownerName !== 'DataView')
            throw new Error(`No probe exists for ${ownerName}.`,);
          /**
           * Every member the interface declares, read off a real instance.
           */
          const surface = [
            ...Object.getOwnPropertyNames(DataView.prototype,),
          ]
            .filter(function isProbeable(memberName,): boolean {
              return memberName !== 'constructor';
            },);
          for (const memberName of surface) {
            const { view, snapshot, } = probeView();
            /**
             * Bytes before the member runs.
             */
            const before = snapshot();
            exerciseMember({ view, memberName, },);
            /**
             * Bytes after the member runs.
             */
            const after = snapshot();
            if (declared.has(memberName,) && (before !== after))
              wroteDespiteDeclared.push(`${ownerName}.${memberName}`,);
            if ((!declared.has(memberName,)) && (before === after))
              inertDespiteAbsent.push(`${ownerName}.${memberName}`,);
          }
        }
        /* A non-empty first list means this authority calls a member read-only that writes the
         * receiver, which would let the rule offer a parameter it rewrites. A non-empty second
         * means it calls a member mutating that changes nothing, which costs a discharge the
         * derivation should have made. The entry goes rather than either comparison. */
        expect(wroteDespiteDeclared,).toEqual([],);
        expect(inertDespiteAbsent,).toEqual([],);
      },
    },),
    it({
      name: 'keeps the pinned entry count matching the declared membership',
      fn: async () => {
        /**
         * Members declared across every unpaired interface.
         */
        const declaredCount = [...UNPAIRED_VIEW_INTERFACES.values(),]
          .reduce(function addSize(total, members,): number {
            return total + members.size;
          }, 0,);
        expect(declaredCount,).toBe(VERIFIED_UNPAIRED_VIEW_COUNT,);
      },
    },),
  ],
},);
