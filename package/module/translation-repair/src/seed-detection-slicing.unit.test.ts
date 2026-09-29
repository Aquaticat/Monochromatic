/**
 Tests that seed detection reads an issue's slice index against THE SLICES
 THE REPAIR RAN ON, front matter included.

 WHAT WAS MEASURED (audit area six, 2026-09-28). `repairTranslation` prepares
 with `prepareDocumentPair`, which leads with a front-matter slice whenever
 both documents carry visible metadata, and every issue record names its
 slice by that numbering. `gradeSeedDetection` rebuilt the slicing by aligning
 sections and subdividing them, which leaves the front matter out, so every
 index read the slice after the one the issue was written against. All 92
 pinned pairs carry that front matter, so on corpus-shaped documents every
 reported issue landed on the wrong slice or on none.

 THE FIXTURE CARRIES FRONT MATTER, which the older grading tests did not, and
 finds the seed's slice through the repair entry's own preparation.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applySeededErrors,
  gradeSeedDetection,
  hashContent,
  prepareDocumentPair,
  type SeededErrorSpec,
} from '../dist/final/node/index.mjs';

/**
 Deletion seed removing the butterfly sentence.
 */
const BUTTERFLY_SEED: SeededErrorSpec = {
  id: 'seed/omission-front-matter',
  category: 'accuracy/omission',
  kind: 'deletion',
  needle: ' The cat also chases crimson butterflies across the meadow.',
  replacement: '',
};

/**
 Characters the fixture span covers.
 */
const SPAN_WIDTH = 10;

/**
 Original, with front matter the way corpus pages carry it.
 */
const SOURCE_TEXT = '---\nname: 猫猫\n---\n\n## 简介\n\n猫猫在太阳下打盹。猫猫也追蝴蝶。碗是满的。\n';

/**
 Clean translation the seed deletes from, with its own front matter.
 */
const TARGET_TEXT = '---\nname: Whiskers\n---\n\n## Introduction\n\n'
  + 'The cat naps in the sun. The cat also chases crimson butterflies across the meadow. The bowl stays full.\n';

await describe({
  name: gradeSeedDetection.name,
  children: [
    it({
      name: 'FINDS AN ACCEPTED ISSUE ON A DOCUMENT WITH FRONT MATTER, reading its slice index the way the '
        + 'repair entry numbered it',
      fn: async () => {
        /**
         Deletion planted into the translation.
         */
        const {
          seededText,
          applications,
        } = applySeededErrors({
          text: TARGET_TEXT,
          specs: [BUTTERFLY_SEED,],
        },);

        /**
         Application region of the planted seed.
         */
        const [application,] = applications;
        if (application === undefined)
          throw new Error('fixture planting failed',);

        /**
         Slices the repair entry prepares over the seeded pair.
         */
        const { slices, } = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: seededText,
        },);

        /**
         Slice whose target region covers the planted seed.
         */
        const slicePosition = slices.findIndex(function covers(slice,): boolean {
          return (slice.target.startOffset <= application.startOffset)
            && (application.startOffset < slice.target.endOffset);
        },);
        // The front-matter slice leads, so the seed's slice is not the first.
        expect(slicePosition,).toBeGreaterThan(0,);

        /**
         Slice the seed landed in, present since `slicePosition` is past zero.
         */
        const slice = slices[slicePosition];
        if (slice === undefined)
          throw new Error('fixture lost its slice',);

        /**
         Issue span start, local to that slice.
         */
        const localStart = application.startOffset - slice.target.startOffset;
        const detected = gradeSeedDetection({
          sourceText: SOURCE_TEXT,
          seededText,
          applications,
          issues: [
            {
              sliceIndex: slice.target.sliceIndex,
              resolved: false,
              repairRegions: [],
              repairDisposition: 'no-region' as const,
              refined: false,
              issue: {
                issueId: 'adjudicated/front-matter',
                status: 'accepted' as const,
                severity: 'major' as const,
                claims: [
                  {
                    claimId: 'issue/front-matter',
                    claim: {
                      category: 'accuracy/omission' as const,
                      severity: 'major' as const,
                      summary: 'The butterfly sentence is missing.',
                      spans: [
                        {
                          side: 'target' as const,
                          nodeId: 'block/1',
                          nodeHash: hashContent({ content: 'invented', },),
                          startOffset: localStart,
                          endOffset: localStart + SPAN_WIDTH,
                          quotedText: seededText.slice(
                            application.startOffset,
                            application.startOffset + SPAN_WIDTH,
                          ),
                        },
                      ],
                    },
                  },
                ],
                tallies: {},
              },
            },
          ],
        },);
        expect(detected[BUTTERFLY_SEED.id],).toBe('accepted',);
      },
    },),
  ],
},);
