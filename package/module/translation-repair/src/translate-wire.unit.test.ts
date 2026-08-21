/**
 * Tests for what the translator sheet says about the shape of a passage.
 *
 * WHY THE SHEET AND THE GUARD HAVE TO AGREE. `validateTranslatedSlice` floors a
 * candidate on the PAGE AS IT STANDS: every block of the existing translation
 * must appear in the rendering, in order. A translator told only that the
 * ORIGINAL's structure is preserved drops the archive's own splits and merges
 * by following its instructions, fails the guard, and buys a repair round at
 * every reshaped slice. The two texts disagree about shape on real entries, so
 * this is not a hypothetical.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { buildTranslateMessages, } from '../dist/final/node/index.mjs';

/**
 * Cat-themed passage standing in for a source, since the sheet does not vary
 * with what it is given.
 */
const SOURCE_TEXT = '猫在窗台上睡觉。';

/**
 * Existing translation shaped differently from the source: one block quoted.
 */
const EXISTING_TEXT = '> The cat sleeps on the windowsill.';

/**
 * System half of the sheet, which is where every standing rule lives.
 */
const system = buildTranslateMessages({
  sourceText: SOURCE_TEXT,
  existingText: EXISTING_TEXT,
},)
  .messages
  .filter(function isSystem(message,): boolean {
    return message.role === 'system';
  },)
  .map(function toContent(message,): string {
    return message.content;
  },)
  .join('\n',);

/**
 * Same sheet for a chunk whose ORIGINAL is verse, where a second shape rule
 * arrives and points the other way.
 */
const verseSystem = buildTranslateMessages({
  sourceText: SOURCE_TEXT,
  existingText: EXISTING_TEXT,
  lineStructured: true,
},)
  .messages
  .filter(function isSystem(message,): boolean {
    return message.role === 'system';
  },)
  .map(function toContent(message,): string {
    return message.content;
  },)
  .join('\n',);

await describe({
  name: 'translate wire shape rule',
  children: [
    it({
      name: 'KEEPS the shape of the existing translation where it differs',
      fn: async () => {
        // The guard's floor, stated to the producer that has to clear it.
        expect(system.includes('KEEP THE EXISTING TRANSLATION\'S SHAPE',),).toBe(true,);
      },
    },),
    it({
      name: 'NAMES what a dropped block costs, rather than only forbidding it',
      fn: async () => {
        // A rule with a consequence attached survives summarisation; a bare
        // prohibition is the first thing a model drops.
        expect(system.includes('deletes that block from the page',),).toBe(true,);
      },
    },),
    it({
      name: 'RANKS the declared spelling above the archive\'s own usage',
      fn: async () => {
        // Without a stated precedence the translator is told the archive's
        // spelling is authoritative while the judge is told the declared one
        // is, and a page that contradicts its own front matter costs the slice
        // its whole judged decision.
        expect(system.includes('THE DECLARED SPELLING WINS',),).toBe(true,);
        expect(system.includes('Never invent a third spelling',),).toBe(true,);
      },
    },),
    it({
      name: 'RANKS the verse rule above the keep-the-page rule, and only on verse',
      fn: async () => {
        // Both rules reach one prompt on a line-structured chunk and they point
        // opposite ways: on `Toka_ls` the Chinese runs 21 blocks against the
        // rendering's 18, so one says keep 18 and the other says restore 21.
        // The guard cannot settle it either way, being a kind-sequence floor
        // that passes a candidate carrying MORE blocks than the page, so the
        // sheet has to say which wins.
        expect(verseSystem.includes('THIS RULE OUTRANKS THE STANDING RULE',),).toBe(true,);
        expect(verseSystem.includes('unmerge them',),).toBe(true,);
        // Prose keeps the page's shape, so the precedence must not leak there.
        expect(system.includes('THIS RULE OUTRANKS THE STANDING RULE',),).toBe(false,);
        expect(system.includes('KEEP THE EXISTING TRANSLATION\'S SHAPE',),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS every Markdown marker the source uses',
      fn: async () => {
        // The other half of the guard: markers are counted against the
        // ORIGINAL, so the sheet still has to ask for them.
        expect(system.includes('footnote markers',),).toBe(true,);
        expect(system.includes('block quotes',),).toBe(true,);
      },
    },),
  ],
},);
