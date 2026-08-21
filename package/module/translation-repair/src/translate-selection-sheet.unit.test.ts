/**
 * Tests for what the translate lane's judges are told.
 *
 * WHY A SHEET OF CONSTANTS IS WORTH PINNING. These strings are the only thing
 * standing between a judge and the wrong reading of `nothing added`. Measured on
 * one contested slice, three of six judges rejected a candidate for carrying a
 * declared alias, every one of them having been shown the declared names. The
 * separate names criterion did not stop them, because it reads as spelling
 * guidance while `nothing added` reads as a rule. Losing the carve-out again
 * would cost accurate detail on memorial pages and nothing here would fail.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  TRANSLATE_SELECTION_CRITERIA,
  TRANSLATE_SELECTION_TASK,
} from '../dist/final/node/index.mjs';

/**
 * Criteria joined, since a judge reads them as one list.
 */
const sheet = TRANSLATE_SELECTION_CRITERIA.join('\n',);

await describe({
  name: 'translate selection sheet',
  children: [
    it({
      name: 'CARVES declared names out of the rule that forbids additions',
      fn: async () => {
        /**
         * Criterion carrying the prohibition judges actually applied.
         */
        const faithfulness = TRANSLATE_SELECTION_CRITERIA
          .find(function forbidsAdditions(line,): boolean {
            return line.includes('nothing added',);
          },) ?? '';
        expect(faithfulness,).not.toBe('',);
        // THE CARVE-OUT SITS INSIDE THAT CRITERION, not beside it, because the
        // rule being misapplied is the one that has to name the exception.
        expect(faithfulness.includes('NEVER AN ADDITION',),).toBe(true,);
      },
    },),
    it({
      name: 'STATES that dropping a declared name is leaving something out',
      fn: async () => {
        expect(sheet.includes('has left something out',),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS coverage and faithfulness ahead of fluency',
      fn: async () => {
        // The ordering the whole lane rests on: a candidate that reads better
        // while saying less must lose.
        const coverage = TRANSLATE_SELECTION_CRITERIA
          .findIndex(function isCoverage(line,): boolean {
            return line.includes('Complete coverage',);
          },);
        const fluency = TRANSLATE_SELECTION_CRITERIA
          .findIndex(function isFluency(line,): boolean {
            return line.includes('idiomatic English',);
          },);
        expect(coverage,).toBe(0,);
        expect(fluency,).toBe(TRANSLATE_SELECTION_CRITERIA.length - 1,);
      },
    },),
    it({
      name: 'NAMES the candidates as complete translations, not as edits',
      fn: async () => {
        expect(TRANSLATE_SELECTION_TASK.includes('complete English translation',),).toBe(true,);
      },
    },),
  ],
},);
