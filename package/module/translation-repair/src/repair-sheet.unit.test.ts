/**
 * Tests for the repair grading sheet, including the property that matters most
 * for comparing rounds: the DETECTION sheet still shows no repair text.
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
  formatGradingSheet,
  formatRepairSheet,
  type GradableRepair,
  type GradingCandidate,
} from '../dist/final/neutral/index.mjs';

/**
 * Replacement text no detection sheet may ever contain.
 */
const REPLACEMENT = 'The cat is asleep on the windowsill.';

/**
 * Text the replacement stands in for.
 */
const REPLACED = 'The cat is doing the sleeping on the windowsill.';

/**
 * Builds one sampled candidate, optionally carrying repair provenance.
 *
 * @param repair - provenance, omitted to model a pre-recording artifact
 *
 * @returns Candidate both sheets render
 *
 * @example
 * ```ts
 * const candidate = catCandidate({},);
 * ```
 */
function catCandidate(
  { repair, }: { readonly repair?: GradableRepair; },
): GradingCandidate {
  return {
    entryId: 'Kitten',
    band: 'medium' as const,
    issueId: 'adjudicated/nap',
    category: 'accuracy/awkward',
    severity: 'minor',
    summary: 'The nap sentence reads as a literal gloss.',
    sourceQuotes: ['猫猫在窗台上睡觉。',],
    targetQuotes: [REPLACED,],
    sourceAnchor: 'quoted' as const,
    ...(repair === undefined ? {} : { repair, }),
  };
}

/**
 * Builds repair provenance with one region.
 *
 * @param disposition - what became of the repair
 *
 * @param issueIds - issues the region serves
 *
 * @param refined - whether the naturalness lane rewrote the slice
 *
 * @returns Provenance the repair sheet renders
 *
 * @example
 * ```ts
 * const repair = catRepair({ disposition: 'shipped', },);
 * ```
 */
function catRepair(
  {
    disposition,
    issueIds = ['adjudicated/nap',],
    refined = false,
  }: {
    readonly disposition: string;
    readonly issueIds?: readonly string[];
    readonly refined?: boolean;
  },
): GradableRepair {
  return {
    disposition,
    regions: [
      {
        issueIds,
        before: REPLACED,
        editorAfter: REPLACEMENT,
      },
    ],
    refined,
    ...(refined
      ? { finalSliceText: 'The cat sleeps on the windowsill all afternoon.', }
      : {}),
  };
}

await describe({
  name: formatRepairSheet.name,
  children: [
    it({
      name: 'the DETECTION sheet still shows no repair text, which is what '
        + 'keeps this round comparable with the rounds already graded',
      fn: async () => {
        // A visible correction makes an alleged defect look more real. If it
        // leaked onto the detection sheet, round three's precision would be
        // measured by a different instrument than round two's.
        const sheet = formatGradingSheet({
          sample: [catCandidate({ repair: catRepair({ disposition: 'shipped', },), },),],
          seed: 'cat-seed',
          bar: 0.9,
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes(REPLACEMENT,),).toBe(false,);
        expect(sheet.includes('repair grade',),).toBe(false,);
      },
    },),

    it({
      name: 'orders the grader to finish detection first and gives a shipped '
        + 'repair its own grade box',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [catCandidate({ repair: catRepair({ disposition: 'shipped', },), },),],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('GRADE THE DETECTION SHEET FIRST',),).toBe(true,);
        expect(sheet.includes(REPLACEMENT,),).toBe(true,);
        expect(sheet.includes('repair grade: [ ]',),).toBe(true,);
      },
    },),

    it({
      name: 'never shows the checker verdict, which would anchor the human '
        + 'toward agreement on the very population they are auditing',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [catCandidate({ repair: catRepair({ disposition: 'shipped', },), },),],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('resolved',),).toBe(false,);
      },
    },),

    it({
      name: 'withholds the grade box where no repair reached the reader, and '
        + 'says which of those happened instead of leaving a gap',
      fn: async () => {
        for (const disposition of [
          'not-selected',
          'withdrawn',
          'no-region',
        ]) {
          /** Sheet for one non-shipping disposition. */
          const sheet = formatRepairSheet({
            sample: [catCandidate({ repair: catRepair({ disposition, },), },),],
            seed: 'cat-seed',
            corpusSha: 'sha/1',
          },);
          expect(sheet.includes('repair grade: [ ]',),).toBe(false,);
          expect(sheet.includes(disposition,),).toBe(true,);
          expect(sheet.includes('counts against coverage',),).toBe(true,);
        }
      },
    },),

    it({
      name: 'withholds the refinement caveat from an ungradable item, since '
        + '"grade the final wording" beside "not graded" is a contradiction '
        + 'the grader would have to resolve alone',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [
            catCandidate({
              repair: catRepair({
                disposition: 'not-selected',
                refined: true,
              },),
            },),
          ],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('grade the FINAL wording',),).toBe(false,);
        expect(sheet.includes('counts against coverage',),).toBe(true,);
      },
    },),

    it({
      name: 'marks a pre-recording item as ungradable rather than as a repair '
        + 'that never happened',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [catCandidate({},),],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('NOT GRADABLE',),).toBe(true,);
        expect(sheet.includes('repair grade: [ ]',),).toBe(false,);
      },
    },),

    it({
      name: 'shows the final wording and says to grade it when the naturalness '
        + 'lane rewrote the paragraph after the repair was written',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [
            catCandidate({
              repair: catRepair({
                disposition: 'shipped',
                refined: true,
              },),
            },),
          ],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('The cat sleeps on the windowsill all afternoon.',))
          .toBe(true,);
        expect(sheet.includes('grade the FINAL wording',),).toBe(true,);
      },
    },),

    it({
      name: 'discloses the other accepted issues a shared edit was written '
        + 'for, so one replacement is not read as this issue\'s own repair',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [
            catCandidate({
              repair: catRepair({
                disposition: 'shipped',
                issueIds: [
                  'adjudicated/nap',
                  'adjudicated/chase',
                ],
              },),
            },),
          ],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('SHARED',),).toBe(true,);
        expect(sheet.includes('adjudicated/chase',),).toBe(true,);
        expect(sheet.includes('adjudicated/nap',),).toBe(false,);
      },
    },),

    it({
      name: 'numbers items from one so they line up with the detection sheet',
      fn: async () => {
        const sheet = formatRepairSheet({
          sample: [
            catCandidate({ repair: catRepair({ disposition: 'shipped', },), },),
            catCandidate({ repair: catRepair({ disposition: 'no-region', },), },),
          ],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes('### 1. Kitten',),).toBe(true,);
        expect(sheet.includes('### 2. Kitten',),).toBe(true,);
      },
    },),
  ],
},);
