import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FRESH_CONTAINER_MEMBER_NAMES,
  RESULT_PROVENANCE_BY_INTERFACE,
  RESULT_RELATION_OBSERVER_RETURN,
  RESULT_RELATION_RECEIVER_VALUE,
  VERIFIED_RESULT_RELATION_COUNT,
} from '../dist/final/node/index.mjs';

/**
 * Sentinel placed in a receiver, recognised only by identity.
 *
 * A value equal to nothing else, so a member handing back a structurally identical
 * copy fails the probe. Comparing shapes would pass for `structuredClone`.
 */
type Sentinel = { readonly marker: 'receiver-held'; };

/**
 * Value only an observer can put into a result, recognised by identity.
 *
 * Distinct from the receiver's sentinel on purpose. A member claiming the observer-return
 * relation has to hand back what the observer produced and nothing the receiver held, and
 * one marker could not tell those apart.
 */
const OBSERVER_MARKER: { readonly marker: 'observer-returned'; } = {
  marker: 'observer-returned',
};

/**
 * Builds one receiver of the named interface holding the sentinel.
 *
 * @param ownerName - Declaring default-library interface name.
 *
 * @param sentinel - Value to place inside the receiver.
 *
 * @returns receiver holding sentinel, and arguments reaching it.
 *
 * @example
 * ```ts
 * receiverHolding({ ownerName: 'Map', sentinel });
 * ```
 */
function receiverHolding({
  ownerName,
  sentinel,
}: {
  readonly ownerName: string;
  readonly sentinel: Sentinel;
},): {
  readonly receiver: unknown;
  readonly argumentsByMember: Readonly<Record<string, readonly unknown[]>>;
} {
  if (ownerName.endsWith('Map',))
    return {
      receiver: new Map([['key', sentinel,],],),
      argumentsByMember: { get: ['key',], },
    };
  return {
    receiver: [sentinel,],
    argumentsByMember: {
      at: [0,],
      /* A predicate that accepts, so the probe measures what the member hands back on a
       * hit. The miss path returns `undefined` for both, which is not the sentinel and
       * would fail the comparison for a reason that says nothing about the relation. */
      filter: [function keepsEvery(): boolean {
        return true;
      },],
      /* An observer returning something the receiver never held, so a member that hands
       * back receiver elements instead fails the probe rather than passing it by
       * coincidence. `flatMap` returns it wrapped, since it flattens one level. */
      map: [function projectsMarker(): unknown {
        return OBSERVER_MARKER;
      },],
      flatMap: [function projectsMarkerList(): readonly unknown[] {
        return [OBSERVER_MARKER,];
      },],
      find: [function acceptsFirst(): boolean {
        return true;
      },],
      findLast: [function acceptsLast(): boolean {
        return true;
      },],
      pop: [],
      shift: [],
      slice: [],
    },
  };
}

await describe({
  name: 'collection member result provenance',
  concurrency: 1,
  children: [
    it({
      name: 'returns the identical value the receiver held, for every listed member',
      fn: async () => {
        /**
         * Entries whose result was not identically the sentinel.
         */
        const notIdentical: string[] = [];
        /**
         * Container entries failing either half of their own probe.
         */
        const notFreshCarrier: string[] = [];
        /**
         * Observer-return entries whose result failed either half of their probe.
         */
        const notObserverDerived: string[] = [];
        for (const [ownerName, members,] of RESULT_PROVENANCE_BY_INTERFACE) {
          for (const [memberName, provenance,] of members) {
            /**
             * Fresh sentinel per member, so one member cannot pass on another's value.
             */
            const sentinel: Sentinel = { marker: 'receiver-held', };
            const { receiver, argumentsByMember, } = receiverHolding({
              ownerName,
              sentinel,
            },);
            /**
             * Value the member handed back.
             */
            const result = (
              (receiver as Record<string, unknown>)[memberName] as (
                this: unknown,
                ...args: readonly unknown[]
              ) => unknown
            ).apply(receiver, [...argumentsByMember[memberName] ?? [],],);
            if (provenance.relation === RESULT_RELATION_RECEIVER_VALUE) {
              if (result !== sentinel)
                notIdentical.push(`${ownerName}.${memberName}`,);
              continue;
            }
            if (provenance.relation === RESULT_RELATION_OBSERVER_RETURN) {
              /* Both halves again, and here they pull apart the two containers. The result
               * must hold what the observer produced, which a member ignoring its observer
               * fails, and must hold nothing the receiver held, which `filter` fails. That
               * second half is what keeps this relation from being applied to a member whose
               * result really does carry caller-owned elements. */
              if ((!Array.isArray(result,))
                || (!result.includes(OBSERVER_MARKER,))
                || result.includes(sentinel,))
                notObserverDerived.push(`${ownerName}.${memberName}`,);
              continue;
            }
            /* Both halves, because either alone passes for the wrong value. A member
             * returning the receiver itself satisfies the membership half, and a member
             * returning an empty fresh array satisfies the freshness half, and the
             * relation claims exactly the conjunction: a new container holding what the
             * receiver holds. */
            if ((result === receiver)
              || (!Array.isArray(result,))
              || (!result.includes(sentinel,)))
              notFreshCarrier.push(`${ownerName}.${memberName}`,);
          }
        }
        /* A non-empty list means a listed member returns something other than the
         * value the receiver held, so crediting its result to the receiver's
         * parameter would attribute mutations to state the caller never shared.
         * Remove the entry rather than weaken this comparison. */
        expect(notIdentical,).toEqual([],);
        expect(notFreshCarrier,).toEqual([],);
        /* A non-empty list means a member claiming to build its result out of observer
         * returns either ignored the observer or handed back receiver elements. Either way
         * the relation is wrong for it, and the entry goes rather than this comparison. */
        expect(notObserverDerived,).toEqual([],);
      },
    },),
    it({
      name: 'excludes fresh containers, whose elements alias while the container does not',
      fn: async () => {
        /* The reason this table is narrow, checked for every excluded member rather
         * than argued for one. Each returns a new array whose elements are the
         * receiver's: element identity holds, container identity does not. Crediting
         * the container to the receiver would attribute `copy.push(x)` to an array
         * that never received it.
         *
         * Driven through dynamic dispatch, so the assertion covers the whole
         * exclusion list and no member is spot-checked by a hand-written call. */
        /**
         * Arguments letting each excluded member return without throwing.
         */
        const containerArguments: Readonly<Record<string, readonly unknown[]>> = {
          slice: [],
          concat: [],
          filter: [
            function keepAll(): boolean {
              return true;
            },
          ],
          toReversed: [],
          toSpliced: [
            0,
            0,
          ],
          with: [
            0,
            { marker: 'receiver-held', },
          ],
          flat: [],
        };
        /**
         * Excluded members whose result was the receiver, or lost its element.
         */
        const notFreshContainer: string[] = [];
        for (const memberName of FRESH_CONTAINER_MEMBER_NAMES) {
          /* Absent from every owner's table, which is what "excluded" has to mean. */
          for (const [, members,] of RESULT_PROVENANCE_BY_INTERFACE)
            expect(members.has(memberName,),).toBe(false,);
          /**
           * Fresh sentinel, so no member can pass on a value another left behind.
           */
          const sentinel: Sentinel = { marker: 'receiver-held', };
          /**
           * Receiver whose container identity is compared against the result's.
           */
          const values: Sentinel[] = [sentinel,];
          /**
           * Container the member handed back.
           */
          const result = (
            (values as unknown as Record<string, unknown>)[memberName] as (
              this: unknown,
              ...args: readonly unknown[]
            ) => unknown
          ).apply(values, [...containerArguments[memberName] ?? [],],);
          if (!Array.isArray(result,)) {
            notFreshContainer.push(`${memberName} returned no array`,);
            continue;
          }
          if (result === values)
            notFreshContainer.push(`${memberName} returned the receiver`,);
        }
        /* A non-empty list means an excluded member is not the fresh container this
         * exclusion assumes, so the reason it is excluded is wrong even if excluding
         * it happens to be safe. */
        expect(notFreshContainer,).toEqual([],);
        /* And the list is not vacuous, which an empty set would make every loop above
         * pass without checking anything. It went from seven to five when `filter` and
         * `slice` gained the container relation, and each name that remains is held back
         * for a reason recorded beside the set: mixed element sources for `concat`, `with`
         * and `toSpliced`, a descendant rather than an element for `flat`, and a probe
         * shape not yet exercised for `toReversed`. */
        expect(FRESH_CONTAINER_MEMBER_NAMES.size,).toBe(5,);
      },
    },),
    it({
      name: 'keeps the pinned entry count matching the table',
      fn: async () => {
        expect(
          [...RESULT_PROVENANCE_BY_INTERFACE.values(),]
            .reduce(function sumEntries(total, members,): number {
              return total + members.size;
            }, 0,),
        ).toBe(VERIFIED_RESULT_RELATION_COUNT,);
      },
    },),
  ],
},);
