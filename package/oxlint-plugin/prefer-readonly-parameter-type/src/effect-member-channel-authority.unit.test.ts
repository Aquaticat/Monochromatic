import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
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
 * Two roles, deliberately distinct. A lookup or removal needs a value the receiver
 * already holds, or it exercises only the miss path. An insertion needs one the
 * receiver does not hold, or it exercises only the overwrite path: `add` on a member
 * already in the set and `set` on a key already in the map both skip insertion
 * entirely, which is the work most likely to reach somewhere unexpected.
 *
 * @param memberName - Member being invoked.
 *
 * @param element - Recording value the receiver already holds.
 *
 * @param fresh - Recording value the receiver does not hold.
 *
 * @returns argument list for the call.
 *
 * @example
 * ```ts
 * probeArguments({ memberName: 'with', element, fresh, });
 * ```
 */
function probeArguments({
  memberName,
  element,
  fresh,
}: {
  readonly memberName: string;
  readonly element: unknown;
  readonly fresh: unknown;
},): readonly unknown[] {
  /**
   * Members needing an index, a key, or a value to be meaningful.
   */
  const byMember: Record<string, readonly unknown[]> = {
    at: [0,],
    includes: [element,],
    indexOf: [element,],
    lastIndexOf: [element,],
    with: [0, fresh,],
    toSpliced: [0, 1, fresh,],
    push: [fresh,],
    unshift: [fresh,],
    fill: [fresh,],
    copyWithin: [0, 1,],
    get: [element,],
    has: [element,],
    set: [fresh, fresh,],
    delete: [element,],
    add: [fresh,],
  };
  return byMember[memberName] ?? [];
}

/**
 * Builds a receiver instrumented on every channel a member could reach.
 *
 * Four tripwires, each a channel the authority claims a member does not take.
 * Species covers `ArraySpeciesCreate`, which reads `constructor[@@species]` and
 * calls it. Element coercion covers `join` and a bare `toSorted()`. Own-index access
 * covers the accessor an array member invokes through `Get` and `Set`, the one hook
 * the own-index channel admits. A `size` accessor covers property reads on a `Map`
 * or `Set`, which an internal-slot member must not perform.
 *
 * The same recording object serves as both element and argument, so element coercion
 * doubles as argument coercion for every member that takes a key or a value.
 * Coercion of an index argument is not exercised and is not a channel typed code can
 * reach: `at`, `with`, `toSpliced` and `copyWithin` declare `number` there, so no
 * caller-owned object with a `Symbol.toPrimitive` can arrive at that position.
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
},): {
  readonly receiver: unknown;
  readonly element: unknown;
  readonly fresh: unknown;
} {
  /**
   * Builds an element recording any coercion a member performs on it.
   *
   * @param order - Sort key, so a default comparator has something to order by.
   *
   * @returns recording element.
   *
   * @example
   * ```ts
   * recordingElement({ order: 1, });
   * ```
   */
  function recordingElement({ order, }: { readonly order: number; },): {
    readonly toString: () => string;
    readonly valueOf: () => number;
  } {
    return {
      toString(): string {
        hits.push('element-coercion',);
        return `probe-${order}`;
      },
      valueOf(): number {
        hits.push('element-coercion',);
        return order;
      },
    };
  }
  /**
   * Element passed as the caller-supplied key or value argument.
   */
  const element = recordingElement({ order: 1, },);
  /**
   * Value the receiver does not hold, so an insertion actually inserts.
   */
  const fresh = recordingElement({ order: 3, },);
  /**
   * Second element, so a member reading past the position it writes still reads one.
   *
   * A one-element receiver made two probes vacuous. `with(0, element)` replaces the
   * only index and so never reads one, and a bare `toSorted()` never compares a pair,
   * which is why its control assertion could not be written. Both are exercised now.
   */
  const other = recordingElement({ order: 2, },);
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
   * Receiver holding two recording elements, instrumented per collection kind.
   *
   * `ArraySpeciesCreate` reads `constructor` off the receiver and then `@@species`
   * off that, so an own property suffices and no subclass is needed.
   */
  const receiver: unknown = ownerName.endsWith('Map',)
    ? new Map([
      [element, element,],
      [other, other,],
    ],)
    : ownerName.endsWith('Set',)
    ? new Set([
      element,
      other,
    ],)
    : [
      element,
      other,
    ];
  Object.defineProperty(receiver, 'constructor', {
    value: speciesRecorder,
    configurable: true,
  },);
  if (Array.isArray(receiver,)) {
    [
      element,
      other,
    ].forEach(function instrumentIndex(indexElement, index,): void {
      Object.defineProperty(receiver, index, {
        get(): unknown {
          hits.push('index-get',);
          return indexElement;
        },
        set(): void {
          hits.push('index-set',);
        },
        configurable: true,
        enumerable: true,
      },);
    },);
    return {
      receiver,
      element,
      fresh,
    };
  }
  Object.defineProperty(receiver, 'size', {
    get(): number {
      hits.push('property-read',);
      return 2;
    },
    configurable: true,
  },);
  return {
    receiver,
    element,
    fresh,
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
  const { receiver, element, fresh, } = instrumentedReceiver({
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
        fresh,
      },),],);
  }
  catch (error: unknown) {
    // No channel admits `threw`, so a throw fails the assertion and names the member
    // instead of passing quietly. An earlier version recorded `index-set` here, which
    // the own-index channel admits, so any TypeError at all would have looked like
    // ordinary evidence of an indexed write. Nothing should reach this: each
    // instrumented index carries a recording setter, so a write is accepted rather
    // than rejected.
    hits.push(`threw:${caughtValueText(error,)}`,);
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
        /* A bare `toSorted()` reaches the same channel through its default comparator,
         * which needs a pair to compare. That is why the receiver holds two elements:
         * with one, this assertion could not be written at all. */
        expect(reachedHooks({
          ownerName: 'Array',
          memberName: 'toSorted',
        },).includes('element-coercion',),).toBe(true,);
        /* The remaining two tripwires need controls of their own, and had none. Both
         * are instrumentation this suite would otherwise trust without evidence: a
         * `property-read` that never fires makes every internal-slot claim vacuous,
         * and an `index-set` that never fires does the same for every write. `fill`
         * is a listed member, so this doubles as proof its channel is observed rather
         * than merely permitted. */
        expect(reachedHooks({
          ownerName: 'Array',
          memberName: 'fill',
        },).includes('index-set',),).toBe(true,);
        /**
         * Hooks reached by reading a `Map` property directly, with no member involved.
         */
        const propertyHits: ProbeHits = [];
        const { receiver, } = instrumentedReceiver({
          ownerName: 'Map',
          hits: propertyHits,
        },);
        void (receiver as ReadonlyMap<unknown, unknown>).size;
        expect(propertyHits,).toEqual(['property-read',],);
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
