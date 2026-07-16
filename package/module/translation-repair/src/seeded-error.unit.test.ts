/**
 * Tests for seed application, region tracking, hit matching, and derivation.
 * Fixtures are cat-themed invention only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  deriveOmissionSeeds,
  splitSentences,
} from './derive-seeds.ts';
import {
  applySeededErrors,
  SEED_MATCH_TOLERANCE,
  SeedApplicationError,
  seedHitByRegion,
  type SeededErrorSpec,
} from './seeded-error.ts';

/**
 * Clean target text seeds are planted into.
 */
const CLEAN = 'The cat naps in the sun. The cat also chases butterflies across the garden. The cat purrs.';

/**
 * Deletion spec over the butterfly sentence.
 */
const DELETE_BUTTERFLIES: SeededErrorSpec = {
  id: 'seed/omission-0',
  category: 'accuracy/omission',
  kind: 'deletion',
  needle: ' The cat also chases butterflies across the garden.',
  replacement: '',
};

await describe({
  name: applySeededErrors.name,
  children: [
    it({
      name: 'tracks a zero-width region at the deletion point',
      fn: async () => {
        /** Application of the single deletion. */
        const result = applySeededErrors({
          text: CLEAN,
          specs: [DELETE_BUTTERFLIES,],
        },);
        expect(result.seededText,).toBe('The cat naps in the sun. The cat purrs.',);
        expect(result.applications,).toEqual([{
          spec: DELETE_BUTTERFLIES,
          startOffset: 24,
          endOffset: 24,
        },],);
      },
    },),

    it({
      name: 'tracks replacement and insertion extents',
      fn: async () => {
        /** Application of one replacement and one insertion. */
        const result = applySeededErrors({
          text: CLEAN,
          specs: [
            {
              id: 'seed/mistranslation-0',
              category: 'accuracy/mistranslation',
              kind: 'replacement',
              needle: 'naps in the sun',
              replacement: 'howls at the moon',
            },
            {
              id: 'seed/addition-0',
              category: 'accuracy/addition',
              kind: 'insertion',
              needle: 'The cat purrs.',
              replacement: ' It signed the treaty.',
            },
          ],
        },);
        expect(result.seededText,).toBe(
          'The cat howls at the moon. The cat also chases butterflies across the garden. The cat purrs. It signed the treaty.',
        );
        // Replacement region covers the written text; insertion region covers
        // only the inserted addition. Slicing the seeded text by the tracked
        // region proves the coordinates instead of hand-counting them.
        expect(
          result.seededText.slice(
            result.applications[0]?.startOffset ?? 0,
            result.applications[0]?.endOffset ?? 0,
          ),
        ).toBe('howls at the moon',);
        expect(
          result.seededText.slice(
            result.applications[1]?.startOffset ?? 0,
            result.applications[1]?.endOffset ?? 0,
          ),
        ).toBe(' It signed the treaty.',);
      },
    },),

    it({
      name: 'rebases earlier regions when a later edit lands before them',
      fn: async () => {
        /** Later spec edits text before the first spec's region. */
        const result = applySeededErrors({
          text: CLEAN,
          specs: [
            {
              id: 'seed/late',
              category: 'accuracy/mistranslation',
              kind: 'replacement',
              needle: 'purrs',
              replacement: 'meows loudly',
            },
            {
              id: 'seed/early',
              category: 'accuracy/mistranslation',
              kind: 'replacement',
              needle: 'The cat naps',
              replacement: 'A dog naps',
            },
          ],
        },);
        /** Region of the first-applied seed after rebasing. */
        const late = result.applications.find(function byId(application,) {
          return application.spec.id === 'seed/late';
        },);
        /** Seeded text sliced by the rebased region. */
        const rebasedSlice = result
          .seededText
          .slice(
            late?.startOffset ?? 0,
            late?.endOffset ?? 0,
          );
        expect(rebasedSlice,).toBe('meows loudly',);
      },
    },),

    it({
      name: 'throws SeedApplicationError on absent and ambiguous needles',
      fn: async () => {
        /** Value caught from an absent needle. */
        let caughtAbsent: unknown;
        try {
          applySeededErrors({
            text: CLEAN,
            specs: [{ ...DELETE_BUTTERFLIES, needle: 'the dog', },],
          },);
        }
        catch (error) {
          caughtAbsent = error;
        }
        expect(caughtAbsent instanceof SeedApplicationError,).toBe(true,);

        /** Value caught from an ambiguous needle. */
        let caughtAmbiguous: unknown;
        try {
          applySeededErrors({
            text: CLEAN,
            specs: [{ ...DELETE_BUTTERFLIES, needle: 'The cat', },],
          },);
        }
        catch (error) {
          caughtAmbiguous = error;
        }
        expect(caughtAmbiguous instanceof SeedApplicationError,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: seedHitByRegion.name,
  children: [
    it({
      name: 'hits within tolerance of a zero-width region and misses beyond it',
      fn: async () => {
        /** Zero-width application at offset 100. */
        const application = {
          spec: DELETE_BUTTERFLIES,
          startOffset: 100,
          endOffset: 100,
        };
        expect(seedHitByRegion({
          spanStart: 100 - SEED_MATCH_TOLERANCE,
          spanEnd: (100 - SEED_MATCH_TOLERANCE) + 5,
          application,
        },),).toBe(true,);
        expect(seedHitByRegion({
          spanStart: 0,
          spanEnd: 100 - SEED_MATCH_TOLERANCE,
          application,
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: splitSentences.name,
  children: [
    it({
      name: 'segments mixed-language text on terminators',
      fn: async () => {
        expect(splitSentences({ text: '猫猫晒太阳。The cat purrs. 还追蝴蝶！', },),).toEqual([
          '猫猫晒太阳。',
          'The cat purrs.',
          '还追蝴蝶！',
        ],);
      },
    },),
  ],
},);

await describe({
  name: deriveOmissionSeeds.name,
  children: [
    it({
      name: 'derives deletion seeds from the longest unique sentences',
      fn: async () => {
        /** Body with two long sentences and one short one. */
        const body = 'The cat purrs. '
          + 'The cat also chases butterflies across the whole garden every morning. '
          + 'The neighbors say the cat naps on the warmest windowsill of the house.';
        /** Derived seeds capped at one. */
        const seeds = deriveOmissionSeeds({
          text: body,
          maxSeeds: 1,
        },);
        expect(seeds,).toHaveLength(1,);
        expect(seeds[0]?.kind,).toBe('deletion',);
        expect(seeds[0]?.category,).toBe('accuracy/omission',);
        expect(seeds[0]?.needle,)
          .toBe('The cat also chases butterflies across the whole garden every morning.',);
      },
    },),

    it({
      name: 'skips short sentences entirely',
      fn: async () => {
        expect(deriveOmissionSeeds({
          text: 'The cat purrs. 猫猫晒太阳。',
          maxSeeds: 3,
        },),).toEqual([],);
      },
    },),
  ],
},);
