/**
 * Tests for the two pure halves of publishing: where a page goes, and what each
 * slice contributes to it.
 *
 * APART FROM `publish-fixed.unit.test.ts` DELIBERATELY, and the reason is a
 * property of the runner rather than of the subject. A file is abandoned once
 * any describe in it fails, so cheap cases sharing a file with expensive ones
 * hide them exactly when something has broken: while these two were in that
 * file, a break in the replacement builder left every case that writes a page
 * unrun and unreported, which reads as a narrow failure rather than a wide one.
 *
 * NOTHING HERE TOUCHES A DISK. Both subjects are total functions of an
 * artifact, so a case that needed a directory would be measuring the writer.
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
  fixedPagePath,
  shippableReplacements,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 * Archive's own wording at the slice every case reads.
 */
const ARCHIVE_MIDDLE = '\nShe slept on the counter by the till.\n';

/**
 * Wording a decider settled on for it.
 */
const DECIDED_MIDDLE = '\nShe slept on the counter beside the till, in the sun.\n';

/**
 * Builds an artifact whose one slice reads as the wording given.
 *
 * GOES THROUGH THE CONTEST rather than the consolidation, because the contest
 * is the shortest path to a chosen wording and this file is about what a
 * settled wording becomes, not about which decider settled it. Which stage is
 * read is `would-ship-text.unit.test.ts`.
 *
 * @param translateText - wording the translate lane offered and the contest picked
 *
 * @returns Artifact the builder reads
 *
 * @example
 * ```ts
 * const artifact = artifactShipping({ translateText: DECIDED_MIDDLE, },);
 * ```
 */
function artifactShipping(
  { translateText, }: { readonly translateText: string; },
): WouldShipSource {
  return {
    comparison: [
      {
        chunkIndex: 1,
        incumbentKind: 'present',
        incumbentText: ARCHIVE_MIDDLE,
        repairText: ARCHIVE_MIDDLE,
        translateText,
        laneRelation: 'both-differ',
        repairOutcome: {
          kind: 'decided',
          acceptedText: ARCHIVE_MIDDLE,
        },
        translateOutcome: {
          kind: 'decided',
          acceptedText: translateText,
        },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'different',
        },
        repairDelivery: { kind: 'replacement-shipped', },
        translateDelivery: { kind: 'replacement-shipped', },
      },
    ],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [
        {
          chunkIndex: 1,
          verdict: {
            kind: 'lane-won',
            lane: 'translate',
          },
          ballots: [],
          usable: 3,
        },
      ],
    },
  } as unknown as WouldShipSource;
}

/**
 * Builds an artifact whose one slice ships nothing at all.
 *
 * REACHES THE SILENCE THROUGH A DECLINED CONTEST OVER AN ARCHIVE THAT HOLDS
 * NOTHING, which is the only way there: every silent reading requires an empty
 * incumbent, so an artifact whose archive speaks cannot produce one however its
 * deciders voted. No settled artifact on disk is in this state, 249 of 249
 * slices carrying archive wording at the last count, which is why the state is
 * built here rather than drawn from output.
 *
 * @returns Artifact whose slice carries no wording from anybody
 *
 * @example
 * ```ts
 * const artifact = artifactShippingNothing();
 * ```
 */
function artifactShippingNothing(): WouldShipSource {
  return {
    comparison: [
      {
        chunkIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: '',
        laneRelation: 'both-differ',
        repairOutcome: { kind: 'unfilled', },
        translateOutcome: { kind: 'unfilled', },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'same',
        },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'gap-remains', },
      },
    ],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [
        {
          chunkIndex: 1,
          verdict: { kind: 'settled-neither', },
          ballots: [],
          usable: 3,
        },
      ],
    },
  } as unknown as WouldShipSource;
}

await describe({
  name: fixedPagePath.name,
  children: [
    it({
      name:
        'NAMES THE CORPUS\'S OWN PATH for an entry, `people/<id>/page.en.md`, because the owner asked '
        + 'for the corpus directory structure replicated rather than for a flat pile named by id: a '
        + 'tree shaped this way can be diffed against the one it mirrors with nothing to translate first',
      fn: async () => {
        expect(fixedPagePath({
          publishDir: '/tmp/run/fixed',
          entryId: 'BookshopCat',
        },),).toBe('/tmp/run/fixed/people/BookshopCat/page.en.md',);
      },
    },),
  ],
},);

await describe({
  name: shippableReplacements.name,
  children: [
    it({
      name:
        'HANDS A SILENT SLICE THE EMPTY STRING rather than dropping it from the list, since a slice '
        + 'the assembler is never told about keeps whatever the archive had there. The deciders '
        + 'agreeing that nothing belongs at a passage is a decision, and republishing the archive '
        + 'underneath it would undo it',
      fn: async () => {
        expect(shippableReplacements({ artifact: artifactShippingNothing(), },),).toEqual([
          {
            chunkIndex: 1,
            replacementText: '',
          },
        ],);
      },
    },),

    it({
      name:
        'CARRIES THE DECIDED WORDING for a slice that settled on some, which is what makes the case '
        + 'above evidence: a builder that emitted the empty string for everything would satisfy it '
        + 'just as well and would publish an empty page',
      fn: async () => {
        expect(shippableReplacements({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
        },),).toEqual([
          {
            chunkIndex: 1,
            replacementText: DECIDED_MIDDLE,
          },
        ],);
      },
    },),
  ],
},);
