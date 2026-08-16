/**
 * Tests for version 2's own comparison rules.
 *
 * WHAT THESE PIN is what version 2 MEANS, which is a different question from
 * what the pipeline currently computes. The rules are duplicated from the live
 * comparator on purpose: the vocabulary froze the words a row may use and this
 * freezes how a row is decided, so a later change to the pipeline's verdicts
 * cannot reinterpret artifacts already on disk under an unchanged version.
 *
 * They also pin the pair the rules exist to keep apart, which equal text cannot:
 * a blank slice the archive does translate and a passage it never translated
 * both carry the empty string.
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
  type ArtifactDeliveryRowV2,
  assertDerivationsAgree,
  compareLanesV2,
} from '../../dist/final/node/index.mjs';

/**
 * Archive wording of the slice both lanes work on.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Original of that slice.
 */
const SOURCE_NAP = '猫猫在窗台上睡觉。';

/**
 * Builds one delivery row, defaulting everything a case does not care about.
 *
 * @param chunkIndex - slice this row is for
 *
 * @param incumbentKind - whether the archive holds wording here
 *
 * @param incumbentText - archive's own wording
 *
 * @param shippedText - what this lane's document carries
 *
 * @param outcome - what this lane did
 *
 * @param delivery - how the document came to carry what it carries
 *
 * @returns Row shaped as version 2 records one
 *
 * @example
 * ```ts
 * const row = row({ chunkIndex: 0, shippedText: ARCHIVE_NAP, },);
 * ```
 */
function deliveryRow(
  {
    chunkIndex,
    incumbentKind,
    incumbentText,
    shippedText,
    outcome,
    delivery,
  }: {
    readonly chunkIndex: number;
    readonly incumbentKind: 'present' | 'absent';
    readonly incumbentText: string;
    readonly shippedText: string;
    readonly outcome: ArtifactDeliveryRowV2['outcome'];
    readonly delivery: ArtifactDeliveryRowV2['delivery'];
  },
): ArtifactDeliveryRowV2 {
  return {
    chunkIndex,
    sourceText: SOURCE_NAP,
    incumbentKind,
    incumbentText,
    outcome,
    shippedText,
    delivery,
  };
}

/**
 * One row where the lane kept the archive's wording after examining it.
 *
 * @param chunkIndex - slice this row is for
 *
 * @returns Row carrying a decision that matches the archive
 *
 * @example
 * ```ts
 * const kept = keptArchive({ chunkIndex: 0, },);
 * ```
 */
function keptArchive({ chunkIndex, }: { readonly chunkIndex: number; },): ArtifactDeliveryRowV2 {
  return deliveryRow({
    chunkIndex,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    shippedText: ARCHIVE_NAP,
    outcome: {
      kind: 'decided',
      acceptedText: ARCHIVE_NAP,
    },
    delivery: { kind: 'incumbent-retained', },
  },);
}

/**
 * One row where the lane shipped a replacement.
 *
 * @param chunkIndex - slice this row is for
 *
 * @param text - wording it shipped
 *
 * @returns Row carrying a shipped replacement
 *
 * @example
 * ```ts
 * const shipped = shippedText({ chunkIndex: 0, text: 'The cat naps.', },);
 * ```
 */
function shipped(
  {
    chunkIndex,
    text,
  }: {
    readonly chunkIndex: number;
    readonly text: string;
  },
): ArtifactDeliveryRowV2 {
  return deliveryRow({
    chunkIndex,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    shippedText: text,
    outcome: {
      kind: 'decided',
      acceptedText: text,
    },
    delivery: { kind: 'replacement-shipped', },
  },);
}

await describe({
  name: compareLanesV2.name,
  children: [
    it({
      name:
        'names the four ways two documents can differ on a slice, which is the reading a later analysis '
        + 'joins on: neither moved, one moved, both moved to the same words, both moved to different ones',
      fn: async () => {
        /**
         * Wording the repair lane shipped.
         */
        const mended = 'The cat is asleep on the windowsill.';

        /**
         * Wording the translate lane shipped where it differed.
         */
        const fresh = 'The cat naps on the windowsill.';

        /**
         * Four slices, one per verdict the rules can reach with an archive
         * present.
         */
        const rows = compareLanesV2({
          repair: [
            keptArchive({ chunkIndex: 0, },),
            shipped({ chunkIndex: 1, text: mended, },),
            shipped({ chunkIndex: 2, text: fresh, },),
            shipped({ chunkIndex: 3, text: mended, },),
          ],
          translate: [
            keptArchive({ chunkIndex: 0, },),
            keptArchive({ chunkIndex: 1, },),
            shipped({ chunkIndex: 2, text: fresh, },),
            shipped({ chunkIndex: 3, text: fresh, },),
          ],
        },);
        expect(rows.map(function toVerdict(one,): string {
          return one.verdict;
        },),).toEqual([
          'archive-stands',
          'repair-only',
          'both-agree',
          'both-differ',
        ],);
      },
    },),
    it({
      name:
        'separates a passage the archive NEVER translated from its wording standing, which equal text '
        + 'cannot: a blank slice and an untranslated one both carry the empty string, and reporting the '
        + 'second as the archive standing tells a reader a translation is being kept where none exists',
      fn: async () => {
        /**
         * One anchor neither lane filled, and one blank slice the archive does
         * hold.
         */
        const rows = compareLanesV2({
          repair: [
            deliveryRow({
              chunkIndex: 0,
              incumbentKind: 'absent',
              incumbentText: '',
              shippedText: '',
              outcome: { kind: 'not-applicable', },
              delivery: { kind: 'gap-remains', },
            },),
            deliveryRow({
              chunkIndex: 1,
              incumbentKind: 'present',
              incumbentText: '',
              shippedText: '',
              outcome: {
                kind: 'decided',
                acceptedText: '',
              },
              delivery: { kind: 'incumbent-retained', },
            },),
          ],
          translate: [
            deliveryRow({
              chunkIndex: 0,
              incumbentKind: 'absent',
              incumbentText: '',
              shippedText: '',
              outcome: { kind: 'unfilled', },
              delivery: { kind: 'gap-remains', },
            },),
            deliveryRow({
              chunkIndex: 1,
              incumbentKind: 'present',
              incumbentText: '',
              shippedText: '',
              outcome: {
                kind: 'decided',
                acceptedText: '',
              },
              delivery: { kind: 'incumbent-retained', },
            },),
          ],
        },);
        expect(rows.map(function toVerdict(one,): string {
          return one.verdict;
        },),).toEqual([
          'gap-remains',
          'archive-stands',
        ],);
      },
    },),
    it({
      name:
        'reports the two lanes` DECISIONS apart from what their documents carry, so a slice one lane '
        + 'never decided reads as not comparable rather than as the two having chosen differently',
      fn: async () => {
        /**
         * One slice the repair lane heard nobody about.
         */
        const rows = compareLanesV2({
          repair: [
            deliveryRow({
              chunkIndex: 0,
              incumbentKind: 'present',
              incumbentText: ARCHIVE_NAP,
              shippedText: ARCHIVE_NAP,
              outcome: { kind: 'incumbent-fallback', },
              delivery: { kind: 'incumbent-retained', },
            },),
          ],
          translate: [keptArchive({ chunkIndex: 0, },),],
        },);
        expect(rows[0]?.decisionComparison,).toEqual({
          kind: 'not-comparable',
          undecidedLanes: ['repair',],
        },);

        // And the document verdict still says both carry the archive, which is
        // a different fact from either lane having chosen it.
        expect(rows[0]?.verdict,).toBe('archive-stands',);
      },
    },),
    it({
      name:
        'REFUSES two ledgers of different lengths, and two that name different slices at one position: '
        + 'a comparison joined by index alone would accept rows in the wrong order, which is one of the '
        + 'things reading by position exists to catch',
      fn: async () => {
        expect(function lengthsDiffer() {
          compareLanesV2({
            repair: [
              keptArchive({ chunkIndex: 0, },),
              keptArchive({ chunkIndex: 1, },),
            ],
            translate: [keptArchive({ chunkIndex: 0, },),],
          },);
        },).toThrow('cover 2 and 1 slices',);

        expect(function positionsDisagree() {
          compareLanesV2({
            repair: [
              keptArchive({ chunkIndex: 0, },),
              keptArchive({ chunkIndex: 1, },),
            ],
            translate: [
              keptArchive({ chunkIndex: 1, },),
              keptArchive({ chunkIndex: 0, },),
            ],
          },);
        },).toThrow('position 0 names slice 0',);
      },
    },),
    it({
      name:
        'REFUSES two ledgers that disagree about whether the archive translates a slice, even where both '
        + 'carry the same text, since that disagreement is exactly the pair equal text hides',
      fn: async () => {
        expect(function kindsDisagree() {
          compareLanesV2({
            repair: [
              deliveryRow({
                chunkIndex: 0,
                incumbentKind: 'present',
                incumbentText: '',
                shippedText: '',
                outcome: {
                  kind: 'decided',
                  acceptedText: '',
                },
                delivery: { kind: 'incumbent-retained', },
              },),
            ],
            translate: [
              deliveryRow({
                chunkIndex: 0,
                incumbentKind: 'absent',
                incumbentText: '',
                shippedText: '',
                outcome: { kind: 'unfilled', },
                delivery: { kind: 'gap-remains', },
              },),
            ],
          },);
        },).toThrow('is present of archive wording to the repair lane',);
      },
    },),
  ],
},);

await describe({
  name: assertDerivationsAgree.name,
  children: [
    it({
      name:
        'ACCEPTS two derivations that match row for row, which is what makes either one answerable for '
        + 'the other while the pipeline`s rules and version 2`s rules still say the same thing',
      fn: async () => {
        /**
         * One comparison, derived once.
         */
        const rows = compareLanesV2({
          repair: [keptArchive({ chunkIndex: 0, },),],
          translate: [keptArchive({ chunkIndex: 0, },),],
        },);
        assertDerivationsAgree({
          frozen: rows,
          live: rows,
        },);
      },
    },),
    it({
      name:
        'REFUSES a disagreement, because an artifact written while the two derivations differ would mean '
        + 'something the version number does not say: a stopped pass is the cheap outcome, since whoever '
        + 'changed the rules then decides whether version 2 changed with them',
      fn: async () => {
        /**
         * What version 2's rules say about one kept slice.
         */
        const frozen = compareLanesV2({
          repair: [keptArchive({ chunkIndex: 0, },),],
          translate: [keptArchive({ chunkIndex: 0, },),],
        },);

        /**
         * The same rows with one verdict changed, standing in for a pipeline
         * whose rules have moved.
         */
        const live = frozen.map(function retitle(row,) {
          return {
            ...row,
            verdict: 'both-agree' as const,
          };
        },);
        expect(function derivationsDiffer() {
          assertDerivationsAgree({
            frozen,
            live,
          },);
        },).toThrow('disagree about slice 0',);
      },
    },),
    it({
      name:
        'REFUSES derivations of different lengths, so a comparator that dropped or added a row is caught '
        + 'before the row-by-row reading starts and reports the counts rather than a field',
      fn: async () => {
        /**
         * One row, against nothing.
         */
        const frozen = compareLanesV2({
          repair: [keptArchive({ chunkIndex: 0, },),],
          translate: [keptArchive({ chunkIndex: 0, },),],
        },);
        expect(function lengthsDiffer() {
          assertDerivationsAgree({
            frozen,
            live: [],
          },);
        },).toThrow('derives 1 comparison rows where the pipeline derives 0',);
      },
    },),
  ],
},);
