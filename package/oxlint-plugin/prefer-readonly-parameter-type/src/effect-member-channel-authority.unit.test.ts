import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ITERATOR_MEMBER_NAMES,
  MEMBER_CHANNEL_RECEIVER_INDEX,
  MEMBER_CHANNELS_BY_INTERFACE,
  memberInvokesObserver,
  OBSERVER_BEARING_MEMBER_NAMES,
  VERIFIED_MEMBER_CHANNEL_COUNT,
} from '../dist/final/node/index.mjs';

/**
 * Hook names one probed invocation reached.
 */
type ProbeHits = string[];

/**
 * Steps a drain may take before the probe treats the iterator as non-terminating.
 *
 * A runaway guard rather than an expected count. Every probed receiver holds two
 * elements, so a conforming iterator finishes in three steps including the terminal
 * one, and anything reaching this limit is a defect worth failing on rather than
 * hanging on.
 */
const DRAIN_STEP_LIMIT = 16;

/**
 * Hooks one member reached, split by the operation that reached them.
 *
 * The split is the whole point of probing an iterator member. Creating an iterator
 * and advancing it are different operations reaching different channels, and an
 * entry claiming their union has to show both rather than assert the union directly.
 */
type PhaseHooks = {
  readonly creation: readonly string[];
  readonly drainage: readonly string[];
};

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
 * Advances a returned iterator to exhaustion, when the result is one.
 *
 * Includes the terminal step that reports `done`, because an iterator reads its
 * receiver one last time to discover it is finished, and stopping at the final value
 * would leave that read unmeasured.
 *
 * @param result - Value the probed member returned.
 *
 * @throws Error when a result keeps yielding past the runaway guard.
 *
 * @example
 * ```ts
 * drainIteratorResult({ result: values.entries(), });
 * ```
 */
function drainIteratorResult({ result, }: { readonly result: unknown; },): void {
  if ((result === null) || ((typeof result) !== 'object'))
    return;
  /**
   * Advancing member, present only when the result is an iterator.
   */
  const advance = (result as { readonly next?: unknown; }).next;
  if ((typeof advance) !== 'function')
    return;
  /**
   * Drain position, tracking exhaustion and guarding against a non-terminating result.
   */
  const drain = {
    done: false,
    steps: 0,
  };
  while (!drain.done) {
    drain.steps++;
    if (drain.steps > DRAIN_STEP_LIMIT)
      throw new Error(
        `A probed iterator did not finish within ${DRAIN_STEP_LIMIT} steps, so the drain measured an unbounded operation rather than one collection's worth of reads.`,
      );
    drain.done = (advance as (this: unknown,) => { readonly done?: boolean; })
      .call(result,)
      .done === true;
  }
}

/**
 * Invokes one member on an instrumented receiver, then drains any iterator it returns.
 *
 * @param ownerName - Collection interface declaring member.
 *
 * @param memberName - Member being invoked.
 *
 * @returns hooks reached while creating, and those reached only while draining.
 *
 * @throws Error when the authority lists a member this engine does not provide.
 *
 * @example
 * ```ts
 * reachedHooksByPhase({ ownerName: 'Array', memberName: 'values', });
 * ```
 */
function reachedHooksByPhase({
  ownerName,
  memberName,
}: {
  readonly ownerName: string;
  readonly memberName: string;
},): PhaseHooks {
  /**
   * Hooks reached so far, accumulated across both phases.
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
  /**
   * What the member handed back, kept so an iterator result can be drained.
   */
  const invocation: { result: unknown; } = { result: undefined, };
  try {
    invocation.result = (member as (this: unknown, ...args: unknown[]) => unknown)
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
  /**
   * Hooks the creating call alone reached.
   */
  const creation = [...new Set(hits,),];
  try {
    drainIteratorResult({ result: invocation.result, },);
  }
  catch (error: unknown) {
    hits.push(`threw:${caughtValueText(error,)}`,);
  }
  return {
    creation,
    drainage: [...new Set(hits,),].filter(function reachedOnlyWhileDraining(
      hit,
    ): boolean {
      return !creation.includes(hit,);
    },),
  };
}

/**
 * Reports every hook one member reached across its whole lifetime.
 *
 * The union of both phases, which is what the authority entry claims: a caller asks
 * this authority about the creating call and never gets a second chance to ask about
 * advancement, so the entry has to cover both.
 *
 * @param ownerName - Collection interface declaring member.
 *
 * @param memberName - Member being invoked.
 *
 * @returns hook names reached by creation and drainage together, deduplicated.
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
   * Both phases of one probed member.
   */
  const phases = reachedHooksByPhase({
    ownerName,
    memberName,
  },);
  return [
    ...phases.creation,
    ...phases.drainage,
  ];
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
      name: 'claims iterator members as creation plus drainage, with each phase measured',
      fn: async () => {
        /* Every listed interface declares all three, so absence from any one of them
         * would mean the table grew unevenly rather than deliberately. */
        for (const memberName of ITERATOR_MEMBER_NAMES) {
          for (const [, members,] of MEMBER_CHANNELS_BY_INTERFACE)
            expect(members.has(memberName,),).toBe(true,);
        }
        /* Creation reaches nothing, on every owner and every member. This is the half
         * of the claim that was never in doubt, and it is asserted so that a future
         * engine moving work into the producer fails here rather than silently
         * widening what the entries cover. */
        for (const memberName of ITERATOR_MEMBER_NAMES) {
          for (const ownerName of [
            'Array',
            'Map',
            'Set',
          ]) {
            expect(reachedHooksByPhase({
              ownerName,
              memberName,
            },).creation,).toEqual([],);
          }
        }
        /* Drainage is where an array iterator reaches its receiver, and it reaches the
         * own-index channel the entry claims. `keys` is the member that separates the
         * two phases most sharply: it yields indices, so advancing it never fetches an
         * element and this probe observes nothing at all. What it does read is
         * `length`, which cannot be instrumented here because `length` on a real array
         * is a non-configurable own data property. The sibling trap probe drives the
         * same drain through a `Proxy` and sees that read as `get`. */
        expect(reachedHooksByPhase({
          ownerName: 'Array',
          memberName: 'values',
        },).drainage,).toEqual(['index-get',],);
        expect(reachedHooksByPhase({
          ownerName: 'Array',
          memberName: 'entries',
        },).drainage,).toEqual(['index-get',],);
        expect(reachedHooksByPhase({
          ownerName: 'Array',
          memberName: 'keys',
        },).drainage,).toEqual([],);
        /* Draining a `Map` or `Set` iterator reads internal slots and no property, so
         * the `size` accessor stays untouched through both phases. That accessor is
         * proven to fire by the tripwire control, so an empty result here is evidence
         * rather than an uninstrumented silence. */
        for (const memberName of ITERATOR_MEMBER_NAMES) {
          for (const ownerName of [
            'Map',
            'Set',
          ]) {
            expect(reachedHooksByPhase({
              ownerName,
              memberName,
            },).drainage,).toEqual([],);
          }
        }
      },
    },),
    it({
      name: 'lists no observer-bearing member, whose second obligation this table cannot discharge',
      fn: async () => {
        /* The invariant rather than an accident of which members are listed today. A
         * member's ambient channel and its observer are separate obligations, and only
         * the first is answerable here: `filter` reaches own-index access and default
         * species, both trusted under the stated baseline, and it also runs whatever
         * predicate the caller passed. An entry for it would discharge
         * `rows.filter(foreignMutatingPredicate)` on the ambient half alone, which is the
         * first draft of the trust-baseline work and the reason this assertion exists.
         *
         * Adding `filter` to the table fails this and nothing else, which is the point:
         * without it the mistake is caught by no probe, because every tripwire that
         * member trips is one the baseline now admits. */
        /**
         * Every member the authority lists, whichever interface declares it.
         */
        const listed = [...MEMBER_CHANNELS_BY_INTERFACE.values(),]
          .flatMap(function listedMembers(members,): readonly string[] {
            return [...members.keys(),];
          },);
        expect(listed.filter(function bearsObserver(memberName,): boolean {
          return memberInvokesObserver({ memberName, },);
        },),).toEqual([],);
        /* And the classifier answers rather than always refusing, so the assertion above
         * is not vacuous on an empty predicate. */
        expect(memberInvokesObserver({ memberName: 'filter', },),).toBe(true,);
        expect(memberInvokesObserver({ memberName: 'map', },),).toBe(true,);
        expect(memberInvokesObserver({ memberName: 'at', },),).toBe(false,);
        expect(memberInvokesObserver({ memberName: 'get', },),).toBe(false,);
        /* The set is reachable as data too, since the composition step in
         * `effect-default-library-readonly-view.ts` consults it rather than re-deriving
         * which members take an observer. */
        expect(OBSERVER_BEARING_MEMBER_NAMES.has('reduce',),).toBe(true,);
      },
    },),
  ],
},);
