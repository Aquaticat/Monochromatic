import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { INERT_MEMBERS_BY_INTERFACE, } from '../dist/final/node/index.mjs';

/**
 * Hooks a probe records when a member hands control to user code.
 */
type ProbeHits = string[];

/**
 * Builds a receiver whose species getter and element hooks record invocation.
 *
 * @param kind - Collection interface being probed.
 *
 * @param hits - Accumulator recording every hook the member reaches.
 *
 * @returns receiver and a recording element to pass as an argument.
 *
 * @example
 * ```ts
 * const { receiver, element } = instrumentedReceiver({ kind: 'Map', hits: [] });
 * ```
 */
function instrumentedReceiver({
  kind,
  hits,
}: {
  readonly kind: string;
  readonly hits: ProbeHits;
},): { readonly receiver: unknown; readonly element: unknown; } {
  /**
   * Element recording any coercion the member performs.
   */
  const element = {
    toString(): string {
      hits.push('element.toString',);
      return 'probe';
    },
    valueOf(): number {
      hits.push('element.valueOf',);
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
   * Receiver holding one recording element, with a recording constructor.
   *
   * `ArraySpeciesCreate` reads `constructor` off the receiver and then
   * `@@species` off that, so an own property is enough and no subclass is needed.
   */
  const receiver: unknown = kind.endsWith('Map',)
    ? new Map([[element, element,],],)
    : kind.endsWith('Set',)
    ? new Set([element,],)
    : [element,];
  Object.defineProperty(receiver, 'constructor', {
    value: speciesRecorder,
    configurable: true,
  },);
  return {
    receiver,
    element,
  };
}

/**
 * Arguments that satisfy each probed member's required parameters.
 *
 * @param memberName - Member being invoked.
 *
 * @param element - Recording element usable as a key or value.
 *
 * @returns argument list for the call.
 *
 * @example
 * ```ts
 * probeArguments({ memberName: 'with', element });
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

await describe({
  name: 'inert collection member authority',
  concurrency: 1,
  children: [
    it({
      name: 'every listed member runs no user code in a real engine',
      fn: async () => {
        /**
         * Members whose probe reached user code, which must stay empty.
         */
        const dispatching: string[] = [];
        for (const [ownerName, members,] of INERT_MEMBERS_BY_INTERFACE) {
          for (const memberName of members) {
            /**
             * Hooks reached by this single invocation.
             */
            const hits: ProbeHits = [];
            const { receiver, element, } = instrumentedReceiver({
              kind: ownerName,
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
            (member as (this: unknown, ...args: unknown[]) => unknown)
              .apply(receiver, [...probeArguments({
                memberName,
                element,
              },),],);
            if (hits.length > 0)
              dispatching.push(`${ownerName}.${memberName} reached ${[...new Set(hits,),].join(', ',)}`,);
          }
        }
        /* A non-empty list means the authority claims a member is inert that this
         * engine hands to user code. Remove the entry rather than relax this
         * assertion: the enforcement is the only thing separating this table from
         * the catalogs the audit removed. */
        expect(dispatching,).toEqual([],);
      },
    },),
  ],
},);
