/**
 * Tests for the two verdicts on a standing text and the log line each
 * refusal writes.
 *
 * WHAT THESE PIN: an invalid standing and an unendorsed one are refused
 * for different reasons and the log says which, with the deterministic
 * findings on the first. One warning covered both on the 2026-09-04
 * luxuanwen3 pass, and the cause (a link destination the archive had
 * rewritten) had to be read out of the slice records.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { readStandingVerdict, } from '../dist/final/node/index.mjs';

/**
 * Original slice, linking one destination.
 */
const SOURCE = '她的头像由[画师](https://twitter.com/cat)绘制。';

/**
 * Page rendering that rewrote the destination.
 */
const PAGE_REWRITTEN = 'Her avatar was drawn by [the artist](https://x.com/cat).';

/**
 * Page rendering that kept the destination.
 */
const PAGE_KEPT = 'Her avatar was drawn by [the artist](https://twitter.com/cat).';

/**
 * Logger whose warnings are kept for the assertions, the rest forwarded.
 *
 * @returns Logger and the warnings it received
 *
 * @example
 * ```ts
 * const { l, warnings, } = capturing();
 * ```
 */
function capturing(): {
  readonly l: Logger;
  readonly warnings: string[];
} {
  /**
   * Warnings in the order written.
   */
  const warnings: string[] = [];
  /**
   * Forwarding logger for every level but warn.
   */
  const l: Logger = {
    ...tagged({ tag: 'consolidate-standing-verdict-test', },),
    warn: function warn(message: string,): void {
      warnings.push(message,);
    },
  };
  return {
    l,
    warnings,
  };
}

await describe({
  name: readStandingVerdict.name,
  children: [
    it({
      name: 'WITHHOLDS AN INVALID STANDING and names the finding behind it',
      fn: async () => {
        const { l, warnings, } = capturing();
        expect(readStandingVerdict({
          sourceText: SOURCE,
          standingText: PAGE_REWRITTEN,
          incumbentText: PAGE_REWRITTEN,
          lineStructured: false,
          choice: 'translate',
          contestVerdict: {
            kind: 'lane-won',
            lane: 'translate',
          },
          sliceIndex: 1,
          l,
        },),).toEqual({
          standingValid: false,
          standingMayShip: false,
        },);
        expect(warnings.length,).toBe(1,);
        expect(warnings[0],).toContain('slice 1: consolidation standing text fails the deterministic publication rule',);
        expect(warnings[0],).toContain('link-url https://twitter.com/cat and your translation does not',);
      },
    },),

    it({
      name: 'NAMES A LACK OF ENDORSEMENT on a valid standing the contest declined',
      fn: async () => {
        const { l, warnings, } = capturing();
        expect(readStandingVerdict({
          sourceText: SOURCE,
          standingText: PAGE_KEPT,
          incumbentText: PAGE_KEPT,
          lineStructured: false,
          choice: 'neither',
          contestVerdict: {
            kind: 'settled-neither',
            archive: 'declined',
          },
          sliceIndex: 2,
          l,
        },),).toEqual({
          standingValid: true,
          standingMayShip: false,
        },);
        expect(warnings,).toEqual([
          'slice 2: consolidation standing text lacks contest endorsement and remains retryable',
        ],);
      },
    },),

    it({
      name: 'WRITES NOTHING for a valid standing with a won contest behind it',
      fn: async () => {
        const { l, warnings, } = capturing();
        expect(readStandingVerdict({
          sourceText: SOURCE,
          standingText: PAGE_KEPT,
          incumbentText: PAGE_KEPT,
          lineStructured: false,
          choice: 'translate',
          contestVerdict: {
            kind: 'lane-won',
            lane: 'translate',
          },
          sliceIndex: 3,
          l,
        },),).toEqual({
          standingValid: true,
          standingMayShip: true,
        },);
        expect(warnings,).toEqual([],);
      },
    },),
  ],
},);
