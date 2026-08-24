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
 * Builds an artifact whose one slice is an ANCHOR nobody filled.
 *
 * REACHES THE SILENCE THROUGH A DECLINED CONTEST OVER AN ARCHIVE THAT HOLDS
 * NOTHING. This is the state `XIEPT2` reached live: its translate lane recorded
 * slice 12 unfilled after the judges backed no candidate, the contest then had
 * two blank lanes to choose between, and the archive had no wording to fall
 * back on either.
 *
 * PAIRED WITH {@link artifactWhoseLanesRemovedTheWording}, which is silent at a
 * span the archive DOES render. The two silences assemble differently and the
 * pair is what proves the builder reads `incumbentKind` rather than the reason
 * name: these two carry different reasons and the same reason would not
 * separate them.
 *
 * @returns Artifact whose one slice is an unfilled anchor
 *
 * @example
 * ```ts
 * const artifact = artifactWithAnUnfilledAnchor();
 * ```
 */
function artifactWithAnUnfilledAnchor(): WouldShipSource {
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

/**
 * Builds an artifact whose one slice is a CONTENT span both lanes emptied.
 *
 * REACHES THE SILENCE THROUGH LANES THAT AGREED, which is the only reading that
 * can be silent over an archive that speaks: the two contest paths both name a
 * silent archive in their own reason strings, so a slice the contest never saw
 * is the way here. The contest names no slice at all for that reason.
 *
 * @returns Artifact whose one slice removes wording the archive holds
 *
 * @example
 * ```ts
 * const artifact = artifactWhoseLanesRemovedTheWording();
 * ```
 */
function artifactWhoseLanesRemovedTheWording(): WouldShipSource {
  return {
    comparison: [
      {
        chunkIndex: 1,
        incumbentKind: 'present',
        incumbentText: ARCHIVE_MIDDLE,
        repairText: '',
        translateText: '',
        laneRelation: 'both-differ',
        repairOutcome: {
          kind: 'decided',
          acceptedText: '',
        },
        translateOutcome: {
          kind: 'decided',
          acceptedText: '',
        },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'same',
        },
        repairDelivery: { kind: 'replacement-shipped', },
        translateDelivery: { kind: 'replacement-shipped', },
      },
    ],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [],
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
        'NAMES AN UNFILLED ANCHOR NOWHERE, because a row carrying blank text there claims a '
        + 'rendering was written where none was, and `spliceSlices` refuses that outright. It used '
        + 'to emit one, and the refusal landed in `publishFixedPage`, which runs before the '
        + 'artifact is written: `XIEPT2` recorded the slice unfilled three and a half hours in and '
        + 'then lost the whole entry at the last step, four hours and forty-eight minutes of calls '
        + 'with no page and no artifact kept',
      fn: async () => {
        expect(shippableReplacements({ artifact: artifactWithAnUnfilledAnchor(), },),).toEqual([],);
      },
    },),

    it({
      name:
        'STILL HANDS A SILENT CONTENT SPAN THE EMPTY STRING, which is what makes the anchor case '
        + 'evidence about anchors rather than about silence. Both lanes removing wording the archive '
        + 'holds is a decision, and a slice the assembler is never told about keeps whatever the '
        + 'archive had, so dropping this row would republish that wording and undo them',
      fn: async () => {
        expect(shippableReplacements({ artifact: artifactWhoseLanesRemovedTheWording(), },),).toEqual([
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
