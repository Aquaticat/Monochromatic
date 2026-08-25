/**
 * Tests for the ends of the two helpers that decide WHICH number a fidelity
 * probe may damage.
 *
 * WHY THIS FILE EXISTS. The probe damages a passage on purpose so the critics
 * can be scored on whether they catch it, which means the damage has to sit
 * somewhere the text really carries. Two ends decide that and were measured on
 * 2026-08-25 to decide nothing any case asserts: the scan bound that closes a
 * digit run ending the passage, and the floor that says how short a number may
 * be and still count as one both sides state.
 *
 * `unsupportedVariant`, which chooses the wrong number to put there, is pinned
 * in `fidelity-alteration-variant.unit.test.ts` beside this.
 *
 * BOTH FAILURES ARE SILENT. A run left unclosed, or a number refused at the
 * floor, is a number the probe never damages, so the entry scores as clean
 * while carrying an untested claim rather than reporting that it found nothing
 * to damage.
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

import {
  digitRuns,
  sharedNumber,
} from '../dist/final/node/index.mjs';

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

await describe({
  name: sharedNumber.name,
  children: [
    it({
      name: 'ADMITS A NUMBER EXACTLY AT THE FLOOR, since an age and a count are usually two digits and '
        + 'a floor that excluded its own boundary would leave the probe nothing to damage on most '
        + 'passages that state one',
      fn: async () => {
        expect(sharedNumber({
          cleanText: 'Mittens had 12 kittens that spring.',
          sourceText: '那年春天猫猫生了12只小猫。',
        },),).toBe('12',);
      },
    },),
    it({
      name: 'REFUSES a single digit, which is the control that makes the floor above a floor rather '
        + 'than an accident: one digit is as often a list marker as a claim',
      fn: async () => {
        expect(sharedNumber({
          cleanText: 'Mittens had 5 kittens that spring.',
          sourceText: '那年春天猫猫生了5只小猫。',
        },),).toBe('',);
      },
    },),
    it({
      name: 'PREFERS the longest shared number, so a passage naming a year beside a count offers the '
        + 'probe the one likelier to be a claim than an accident of formatting',
      fn: async () => {
        expect(sharedNumber({
          cleanText: 'In 2019 Mittens had 12 kittens.',
          sourceText: '2019年猫猫生了12只小猫。',
        },),).toBe('2019',);
      },
    },),
  ],
},);
