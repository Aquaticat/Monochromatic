/**
 * Tests for wrapping a consolidation that ships.
 *
 * WHAT THESE PIN is the pair of properties `translate-wrap.unit.test.ts` and
 * `repair-wrap.unit.test.ts` pin on the two lanes, now on the stage that had
 * neither: only wording the consolidation PRODUCED is wrapped, and whether it
 * still differs from what stands is re-derived from the wrapped text rather
 * than taken from the gate's answer.
 *
 * The demotion case is the one with teeth. The gate compares an unwrapped
 * consolidation against the standing text, so it can call a difference real
 * when the only difference is where the lines break. Shipping that would
 * report a change nobody decided on, and would put a slice through the whole
 * delivery path to arrive at the wording it started with.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ConsolidateGateOutcome,
  wrapConsolidation,
} from '../dist/final/node/index.mjs';

/**
 * Logger these hand to the stage, whose output is not what is under test.
 */
const l = tagged({ tag: 'consolidate-wrap-test', },);

/**
 * Builds a gate outcome that settled the way a case needs.
 *
 * @param ships - rendering the gate settled on
 *
 * @returns Outcome shaped as the gate produces one
 *
 * @example
 * ```ts
 * const outcome = gateSettling({ ships: 'consolidated', },);
 * ```
 */
function gateSettling(
  { ships, }: { readonly ships: 'consolidated' | 'standing'; },
): ConsolidateGateOutcome {
  return {
    choice: (ships === 'consolidated') ? 'consolidated' : 'standing',
    ships,
    ballots: [],
    usable: 0,
    findings: [],
  };
}

/**
 * One passage as a producer that ignored the rule would emit it.
 */
const ONE_LONG_LINE = 'The cat naps in the window. She wakes at four. She asks for nothing at all.';

await describe({
  name: wrapConsolidation.name,
  children: [
    it({
      name: 'LEAVES THE STANDING TEXT BYTE FOR BYTE when the gate settled on it, because wrapping a '
        + 'slice that decided to change nothing turns that decision into a change, which is the one '
        + 'edit no reader can usefully judge and the delivery check refuses outright',
      fn: async () => {
        /**
         * Wording already in place, written the way a producer would not.
         */
        const standingText = ONE_LONG_LINE;

        const shipped = wrapConsolidation({
          outcome: gateSettling({ ships: 'standing', },),
          consolidatedText: 'The cat naps.\nShe wakes at four.',
          standingText,
          l,
        },);

        expect(shipped.ships,).toBe('standing',);
        expect(shipped.text,).toBe(standingText,);
        expect(shipped.rewrapped,).toBe(false,);
        expect(shipped.demoted,).toBe(false,);
      },
    },),

    it({
      name: 'WRAPS A CONSOLIDATION THE PRODUCER EMITTED AS ONE LINE, which is the whole defect: both '
        + 'lanes wrap at their assembly step and this stage has none, so seven of eleven and seven of '
        + 'twelve shipped consolidations across the band pair carried the wrapping of whichever model '
        + 'happened to answer',
      fn: async () => {
        const shipped = wrapConsolidation({
          outcome: gateSettling({ ships: 'consolidated', },),
          consolidatedText: ONE_LONG_LINE,
          standingText: 'The cat sleeps somewhere else entirely.',
          l,
        },);

        expect(shipped.ships,).toBe('consolidated',);
        expect(shipped.rewrapped,).toBe(true,);
        expect(shipped.demoted,).toBe(false,);
        expect(shipped.text.split('\n',).length,).toBeGreaterThan(1,);
        expect(shipped.text.includes('She asks for nothing at all.',),).toBe(true,);
      },
    },),

    it({
      name: 'REPORTS NO REWRAP for a producer that already wrote it correctly, so a reader can tell a '
        + 'roster that honours the rule from one this stage is silently correcting',
      fn: async () => {
        /**
         * The same passage, already written the way the rule would have it.
         */
        const alreadyWrapped = 'The cat naps in the window.\nShe wakes at four.\nShe asks for nothing at all.';

        const shipped = wrapConsolidation({
          outcome: gateSettling({ ships: 'consolidated', },),
          consolidatedText: alreadyWrapped,
          standingText: 'The cat sleeps somewhere else entirely.',
          l,
        },);

        expect(shipped.text,).toBe(alreadyWrapped,);
        expect(shipped.rewrapped,).toBe(false,);
        expect(shipped.demoted,).toBe(false,);
      },
    },),

    it({
      name: 'SENDS THE SLICE BACK TO ITS STANDING TEXT when wrapping erases the difference, because '
        + 'the gate compared an unwrapped consolidation and can call a line break a change. Without '
        + 'this a slice travels the whole delivery path to arrive at the wording it started with, and '
        + 'is recorded as a consolidation that shipped',
      fn: async () => {
        /**
         * What stands, written the way the rule would have it.
         */
        const standingText = 'The cat naps in the window.\nShe wakes at four.\nShe asks for nothing at all.';

        const shipped = wrapConsolidation({
          outcome: gateSettling({ ships: 'consolidated', },),
          consolidatedText: ONE_LONG_LINE,
          standingText,
          l,
        },);

        expect(shipped.ships,).toBe('standing',);
        expect(shipped.text,).toBe(standingText,);
        expect(shipped.demoted,).toBe(true,);
      },
    },),

    it({
      name: 'STILL REPORTS THE REWRAP ON A DEMOTED SLICE, since the two facts answer different '
        + 'questions: whether the rule had to correct the producer, and whether anything survived it',
      fn: async () => {
        const shipped = wrapConsolidation({
          outcome: gateSettling({ ships: 'consolidated', },),
          consolidatedText: ONE_LONG_LINE,
          standingText: 'The cat naps in the window.\nShe wakes at four.\nShe asks for nothing at all.',
          l,
        },);

        expect(shipped.rewrapped,).toBe(true,);
        expect(shipped.demoted,).toBe(true,);
      },
    },),
  ],
},);
