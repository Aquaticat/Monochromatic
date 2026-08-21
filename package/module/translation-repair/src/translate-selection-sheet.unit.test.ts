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
 * AND THE CARVE-OUT HAS ITS OWN FAILURE MODE, measured on the consolidation
 * bed once it was written without a scope: a judge abstained from a whole slate
 * because no candidate carried the declared LOCATION, and a shipped rendering
 * signed a note left by a friend of the deceased with the deceased's own name,
 * alias and city. Both directions are pinned here, because a sheet edit that
 * fixes one by reopening the other would otherwise pass.
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
      name: 'SCOPES the carve-out to a passage that refers to the person',
      fn: async () => {
        /**
         * Criterion carrying the prohibition judges actually applied.
         */
        const faithfulness = TRANSLATE_SELECTION_CRITERIA
          .find(function forbidsAdditions(line,): boolean {
            return line.includes('nothing added',);
          },) ?? '';
        // WITHOUT THE SCOPE the carve-out reads as a licence to put the
        // archive's identity block into any passage at all.
        expect(faithfulness.includes('Where the passage refers to this person',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES to make a declared name content the passage owes',
      fn: async () => {
        /**
         * Whether the sheet still tells a judge an unnamed person is a gap.
         */
        const owes = sheet.includes('has left something out',);
        expect(owes,).toBe(false,);
        expect(sheet.includes('has left nothing out',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES to let an attribution line take this person\'s name',
      fn: async () => {
        // A note left BY A FRIEND of the deceased was signed with the dead
        // person's name, alias and city, and the sheet is where that was
        // licensed.
        expect(sheet.includes('attributing the passage to someone ELSE',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES to let a spelling every candidate shares decide the slate',
      fn: async () => {
        // Measured twice at one slice: the identity block declares one form,
        // the archive's passage writes another, every candidate inherits it,
        // and a judge abstained from the whole slate. The incumbent that
        // survives that decline is where the spelling came from.
        expect(sheet.includes('cannot separate them',),).toBe(true,);
        expect(sheet.includes('rather than declining',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES to make the original the authority on shape',
      fn: async () => {
        // Producers are floored on the page, which splits, merges and quotes
        // blocks the original runs as prose. A judge told the original is the
        // standard marks down exactly the renderings the guard demands.
        expect(sheet.includes('structure of the ORIGINAL',),).toBe(false,);
        expect(sheet.includes('A SHAPE THE ORIGINAL DOES NOT HAVE IS NOT A FAULT',),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS a shape rule a judge can check from the candidate alone',
      fn: async () => {
        // The existing translation is on the ballot anonymously and never
        // travels as labelled evidence, so a criterion naming the page would
        // name a text the judge cannot see.
        expect(sheet.includes('PAGE AS IT STANDS',),).toBe(false,);
        expect(sheet.includes('used consistently',),).toBe(true,);
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
