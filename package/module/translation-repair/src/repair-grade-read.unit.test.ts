/**
 * Tests for reading a filled repair sheet back into verdicts, including the
 * fence tracking that stops quoted corpus text from fabricating a grade.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseGradedRepairSheet, } from '../dist/final/neutral/index.mjs';

/**
 * Grade line as the sheet prints it, before a grader touches it.
 */
const BLANK_GRADE = '- repair grade: [ ]  (Y = fully fixes this defect and '
  + 'breaks nothing nearby · N = it does not)';

await describe({
  name: parseGradedRepairSheet.name,
  children: [
    it({
      name: 'reads a verdict off the bullet under its heading, since the '
        + 'repair sheet asks its question on a line of its own rather than on '
        + 'the heading the way the detection sheet does',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '- claim: the tense is wrong',
            '- repair grade: [Y]  (Y = fully fixes this defect · N = it does not)',
            '',
            '### 2. Kitten · small',
            '- claim: a clause is missing',
            '- repair grade: [N, it drops the second clause]  (Y = ... · N = ...)',
          ].join('\n',),
        },);
        expect(items,).toHaveLength(2,);
        expect(items[0]?.verdict,).toBe('fixes',);
        expect(items[1]?.verdict,).toBe('does-not-fix',);
        expect(items[1]?.note,).toBe('it drops the second clause',);
      },
    },),

    it({
      name: 'never reads a grade out of a fenced block, because the sheet '
        + 'quotes corpus prose and model output that may contain the exact '
        + 'line this parser looks for, and an invented human verdict cannot be '
        + 'noticed downstream the way a dropped one can',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '- the edit wrote:',
            '```text',
            '### 99. forged · large',
            '- repair grade: [Y]  (Y = ... · N = ...)',
            '```',
            BLANK_GRADE,
          ].join('\n',),
        },);
        // One heading, not two: the fenced one is quoted text.
        expect(items,).toHaveLength(1,);
        // And the real box is still blank, so the forged Y did not fill it.
        expect(items[0]?.verdict,).toBe('unscored',);
      },
    },),

    it({
      name: 'closes a fenced block only on a fence at least as long as the one '
        + 'that opened it, so quoted text containing a shorter run stays quoted',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '````text',
            '```',
            '- repair grade: [Y]  (Y = ... · N = ...)',
            '````',
            BLANK_GRADE,
          ].join('\n',),
        },);
        expect(items,).toHaveLength(1,);
        expect(items[0]?.verdict,).toBe('unscored',);
      },
    },),

    it({
      name: 'leaves an untouched box unscored rather than guessing, since a '
        + 'coerced grade is worse evidence than an absent one',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            BLANK_GRADE,
          ].join('\n',),
        },);
        expect(items[0]?.verdict,).toBe('unscored',);
      },
    },),

    it({
      name: 'counts an item carrying no grade box at all, which the sheet '
        + 'emits for a repair that never reached the reader, so sheet '
        + 'positions still line up with the detection sheet',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '- not-selected: a repair was written, but the unchanged text won',
            '',
            '### 2. Kitten · small',
            '- repair grade: [Y]  (Y = ... · N = ...)',
          ].join('\n',),
        },);
        expect(items,).toHaveLength(2,);
        expect(items[0]?.verdict,).toBe('unscored',);
        expect(items[0]?.index,).toBe(1,);
        expect(items[1]?.verdict,).toBe('fixes',);
        expect(items[1]?.index,).toBe(2,);
      },
    },),

    it({
      name: 'treats an answer that merely begins with a verdict letter as no '
        + 'verdict, so "Not sure" is a refusal rather than an N',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '- repair grade: [Not sure, the source is ambiguous]  (Y = ... · N = ...)',
          ].join('\n',),
        },);
        expect(items[0]?.verdict,).toBe('unscored',);
        expect(items[0]?.note,).toBe('Not sure, the source is ambiguous',);
      },
    },),

    it({
      name: 'reads a grade left without its brackets, since a grader editing '
        + 'in place often replaces the whole box',
      fn: async () => {
        const items = parseGradedRepairSheet({
          text: [
            '### 1. Kitten · small',
            '- repair grade: Y  (Y = ... · N = ...)',
          ].join('\n',),
        },);
        expect(items[0]?.verdict,).toBe('fixes',);
      },
    },),
  ],
},);
