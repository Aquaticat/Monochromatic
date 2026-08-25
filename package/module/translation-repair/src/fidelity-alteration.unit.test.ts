/**
 * Tests for the two damage-building helpers whose ends nothing asked about.
 *
 * WHY THIS FILE EXISTS. The fidelity probe damages a passage on purpose so the
 * critics can be scored on whether they catch it, which means the damage has to
 * be somewhere the text really carries and has to state something no reading of
 * the original supports. Two ends decide that and were measured on 2026-08-25
 * to decide nothing any case asserts: the scan bound that closes a digit run
 * ending the passage, and the wrap that carries a final nine round to zero.
 *
 * BOTH FAILURES ARE SILENT. A run left unclosed is a number the probe never
 * damages, so the entry scores as clean while carrying an untested claim. A
 * variant that skips zero is still a number, so the damage lands and the reason
 * for choosing it, that it wraps through ten rather than through nine, goes
 * unrecorded.
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

import { digitRuns, } from '../dist/final/node/index.mjs';

await describe({
  name: digitRuns.name,
  children: [
    it({
      name: 'CLOSES a run standing at the very end of a passage, which is where a year or an age most '
        + 'often sits, and where a scan stopping one short of the end would collect nothing',
      fn: async () => {
        expect(digitRuns({ text: 'Mittens turned 12', },),).toEqual(['12',],);
      },
    },),
    it({
      name: 'KEEPS every maximal run in the order it appears, so a passage naming a year and an age '
        + 'offers the probe both rather than whichever it reached first',
      fn: async () => {
        expect(digitRuns({ text: 'In 2019 Mittens turned 12 and slept.', },),).toEqual([
          '2019',
          '12',
        ],);
      },
    },),
  ],
},);
