/**
 * Tests for per-entry benchmark preparation:
 * seeds are planted exactly once, both sides parse, the shared prompt
 * carries the seeded text, and planted ids line up with applications.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  prepareBenchmarkEntry,
} from './prepare-entry.ts';
import type { SeededErrorSpec, } from './seeded-error.ts';

/**
 * Invented zh source of the prepared entry.
 */
const SOURCE_TEXT = '## 猫的日常\n\n小猫喜欢晒太阳。小猫也喜欢追蝴蝶。\n';

/**
 * Clean invented translation the seed deletes from.
 */
const TARGET_TEXT = '## A cat\'s day\n\nThe kitten loves sunbathing. The kitten also chases butterflies.\n';

/**
 * Deletion seed removing the butterfly sentence.
 */
const DELETE_BUTTERFLIES: SeededErrorSpec = {
  id: 'seed/omission-0',
  category: 'accuracy/omission',
  kind: 'deletion',
  needle: ' The kitten also chases butterflies.',
  replacement: '',
};

await describe({
  name: prepareBenchmarkEntry.name,
  children: [
    it({
      name: 'plants seeds once and parses the seeded target',
      fn: async () => {
        const prepared = prepareBenchmarkEntry({
          entry: {
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [DELETE_BUTTERFLIES,],
          },
        },);
        expect(prepared.entryId,).toBe('whiskers',);
        expect(prepared.documents.source.text,).toBe(SOURCE_TEXT,);
        expect(prepared.documents.target.text,).not.toContain('butterflies',);
        expect(prepared.documents.target.text,).toContain('loves sunbathing.',);
      },
    },),
    it({
      name: 'builds the shared prompt over the seeded text, not the clean text',
      fn: async () => {
        const prepared = prepareBenchmarkEntry({
          entry: {
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [DELETE_BUTTERFLIES,],
          },
        },);

        /**
         * Whole prompt text across every message, searched for leakage.
         */
        const promptText = prepared
          .messages
          .map(function toContent(message,) {
            return message.content;
          },)
          .join('\n',);
        expect(promptText,).toContain(SOURCE_TEXT.trim(),);
        expect(promptText,).not.toContain('butterflies',);
      },
    },),
    it({
      name: 'lines planted ids up with applications in application order',
      fn: async () => {
        const prepared = prepareBenchmarkEntry({
          entry: {
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [DELETE_BUTTERFLIES,],
          },
        },);
        expect(prepared.plantedSeedIds,).toEqual(['seed/omission-0',],);
        expect(prepared.applications,).toHaveLength(1,);
        expect(prepared.applications[0]?.spec,).toEqual(DELETE_BUTTERFLIES,);
      },
    },),
    it({
      name: 'prepares seedless entries with untouched target text',
      fn: async () => {
        const prepared = prepareBenchmarkEntry({
          entry: {
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [],
          },
        },);
        expect(prepared.documents.target.text,).toBe(TARGET_TEXT,);
        expect(prepared.plantedSeedIds,).toEqual([],);
        expect(prepared.applications,).toEqual([],);
      },
    },),
  ],
},);
