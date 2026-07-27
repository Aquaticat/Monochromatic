import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFERRED_MEMBER_NAMES,
  MEMBER_CHANNEL_RECEIVER_INDEX,
  MEMBER_CHANNELS_BY_INTERFACE,
  VERIFIED_MEMBER_CHANNEL_COUNT,
} from '../dist/final/node/index.mjs';

/**
 * Hook names one probed invocation reached.
 */
type ProbeHits = string[];

/**
 * Hook names admitted by the own-index channel, and by nothing narrower.
 */
const RECEIVER_INDEX_HITS: ReadonlySet<string> = new Set([
  'index-get',
  'index-set',
],);

/**
 * Arguments satisfying each probed member's required parameters.
 *
 * @param memberName - Member being invoked.
 *
 * @param element - Recording element usable as a key, value, or search target.
 *
 * @returns argument list for the call.
 *
 * @example
 * ```ts
 * probeArguments({ memberName: 'with', element, });
 * ```
 */
function probeArguments({
  memberName,
  element,
}: {
  readonly memberName: string;
  readonly element: unknown;
},): readonly unknown[] {
  /**
   * Members needing an index, a key, or a value to be meaningful.
   */
  const byMember: Record<string, readonly unknown[]> = {
    at: [0,],
    includes: [element,],
    indexOf: [element,],
    lastIndexOf: [element,],
    with: [0, element,],
    toSpliced: [0, 0,],
    push: [element,],
    unshift: [element,],
    fill: [element,],
    copyWithin: [0, 0,],
    get: [element,],
    has: [element,],
    set: [element, element,],
    delete: [element,],
    add: [element,],
  };
  return byMember[memberName] ?? [];
}

/**
 * Builds a receiver instrumented on every channel a member could reach.
 *
 * Five tripwires, each a channel the authority claims a member does not take.
 * Species covers `ArraySpeciesCreate`, which reads `constructor[@@species]` and
 * calls it. Element coercion covers `join` and a bare `toSorted()`. Own-index
 * access covers the accessor an array member invokes through `Get` and `Set`, the
 * one hook the own-index channel admits. A `size` accessor covers property reads on
 * a `Map` or `Set`, which an internal-slot member must not perform. Argument
 * coercion covers `ToPrimitive` on what the caller passed.
 *
 * @param ownerName - Collection interface being probed.
 *
 * @param hits - Accumulator recording every hook reached.
 *
 * @returns receiver, plus a recording element to pass as an argument.
 *
 * @example
 * ```ts
 * instrumentedReceiver({ ownerName: 'Map', hits: [], });
 * ```
 */
function instrumentedReceiver({
  ownerName,
  hits,
}: {
  readonly ownerName: string;
  readonly hits: ProbeHits;
},): { readonly receiver: unknown; readonly element: unknown; } {
  /**
   * Element recording any coercion a member performs on it.
   */
  const element = {
    toString(): string {
      hits.push('element-coercion',);
      return 'probe';
    },
    valueOf(): number {
      hits.push('element-coercion',);
      return 1;
    },
  };
  /**
   * Constructor stand-in whose species getter records consultation.
   */
  const speciesRecorder = {
    get [Symbol.species](): unknown {
      hits.push('species',);
      return Array;
    },
  };
  /**
   * Receiver holding one recording element, instrumented per collection kind.
   *
   * `ArraySpeciesCreate` reads `constructor` off the receiver and then `@@species`
   * off that, so an own property suffices and no subclass is needed.
   */
  const receiver: unknown = ownerName.endsWith('Map',)
    ? new Map([[element, element,],],)
    : ownerName.endsWith('Set',)
    ? new Set([element,],)
    : [element,];
  Object.defineProperty(receiver, 'constructor', {
    value: speciesRecorder,
    configurable: true,
  },);
  if (Array.isArray(receiver,)) {
    Object.defineProperty(receiver, 0, {
      get(): unknown {
        hits.push('index-get',);
        return element;
      },
      set(): void {
        hits.push('index-set',);
      },
      configurable: true,
      enumerable: true,
    },);
    return {
      receiver,
      element,
    };
  }
  Object.defineProperty(receiver, 'size', {
    get(): number {
      hits.push('property-read',);
      return 1;
    },
    configurable: true,
  },);
  return {
    receiver,
    element,
  };
}

/**
 * Invokes one member on an instrumented receiver and reports what it reached.
 *
 * @param ownerName - Collection interface declaring member.
 *
 * @param memberName - Member being invoked.
 *
 * @returns hook names reached by this invocation, deduplicated.
 *
 * @example
 * ```ts
 * reachedHooks({ ownerName: 'Array', memberName: 'includes', });
 * ```
 */
function reachedHooks({
  ownerName,
  memberName,
}: {
  readonly ownerName: string;
  readonly memberName: string;
},): readonly string[] {
  /**
   * Hooks reached by this single invocation.
   */
  const hits: ProbeHits = [];
  const { receiver, element, } = instrumentedReceiver({
    ownerName,
    hits,
  },);
  /**
   * Member implementation resolved off the instrumented receiver.
   */
  const member = (receiver as Record<string, unknown>)[memberName];
  if ((typeof member) !== 'function')
    throw new Error(
      `${ownerName}.${memberName} is not callable on the probe receiver, so the authority lists a member this engine does not provide.`,
    );
  try {
    (member as (this: unknown, ...args: unknown[]) => unknown)
      .apply(receiver, [...probeArguments({
        memberName,
        element,
      },),],);
  }
  catch (error: unknown) {
    // An accessor-only index rejects a write, which is itself evidence the member
    // reached that index. Record the attempt rather than let the throw hide it.
    hits.push('index-set',);
    if (!(error instanceof TypeError))
      throw error;
  }
  return [...new Set(hits,),];
}

await describe({
  name: 'collection member channel authority',
  concurrency: 1,
  children: [
    it({
      name: 'every listed member stays inside the channel it claims',
      fn: async () => {
        /**
         * Members whose probe reached a channel wider than claimed.
         */
        const escaped: string[] = [];
        /**
         * Entries probed, cross-checked against the pinned total.
         */
        const probed: string[] = [];
        for (const [ownerName, members,] of MEMBER_CHANNELS_BY_INTERFACE) {
          for (const [memberName, channel,] of members) {
            probed.push(`${ownerName}.${memberName}`,);
            /**
             * Hooks this member's claimed channel does not admit.
             */
            const disallowed = reachedHooks({
              ownerName,
              memberName,
            },)
              .filter(function outsideChannel(hit,): boolean {
                return (channel === MEMBER_CHANNEL_RECEIVER_INDEX)
                  ? !RECEIVER_INDEX_HITS.has(hit,)
                  : true;
              },);
            if (disallowed.length > 0)
              escaped.push(`${ownerName}.${memberName} reached ${disallowed.join(', ',)}`,);
          }
        }
        /* A non-empty list means the authority claims a narrower channel than this
         * engine takes. Move the entry to a wider channel or remove it; never relax
         * this assertion, because the enforcement is the only thing separating this
         * table from the catalogs the audit removed. */
        expect(escaped,).toEqual([],);
        expect(probed.length,).toBe(VERIFIED_MEMBER_CHANNEL_COUNT,);
      },
    },),
    it({
      name: 'reports each tripwire firing for a member the authority excludes',
      fn: async () => {
        /* Without these controls a probe that silently stopped instrumenting would
         * report a clean run for every member, and the table would look verified
         * while proving nothing. Each names an excluded member and the channel that
         * excludes it. */
        expect(reachedHooks({
          ownerName: 'Array',
          memberName: 'slice',
        },).includes('species',),).toBe(true,);
        expect(reachedHooks({
          ownerName: 'Array',
          memberName: 'join',
        },).includes('element-coercion',),).toBe(true,);
        /* A bare `toSorted()` coerces through its default comparator too, but only
         * once it has a pair to compare, and the probe receiver holds one element.
         * `join` covers the same channel on one element, so the pair case is left to
         * the measurement in the decision document rather than asserted here. */
      },
    },),
    it({
      name: 'excludes iterator members, whose effects are deferred past creation',
      fn: async () => {
        for (const memberName of DEFERRED_MEMBER_NAMES) {
          for (const [, members,] of MEMBER_CHANNELS_BY_INTERFACE)
            expect(members.has(memberName,),).toBe(false,);
        }
        /**
         * Hooks reached by creating an iterator, then by advancing it.
         */
        const hits: ProbeHits = [];
        const { receiver, } = instrumentedReceiver({
          ownerName: 'Array',
          hits,
        },);
        /**
         * Iterator over the instrumented receiver.
         */
        const iterator = (receiver as readonly unknown[])[Symbol.iterator]();
        expect(hits,).toEqual([],);
        iterator.next();
        expect(hits.includes('index-get',),).toBe(true,);
      },
    },),
  ],
},);
