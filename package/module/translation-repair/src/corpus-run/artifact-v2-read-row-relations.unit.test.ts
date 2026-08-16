/**
 * Tests for the two row relations at the level they are written, rather than
 * through a whole artifact.
 *
 * WHY NOT THROUGH THE READER: both cases here are about what an error MESSAGE
 * says and about what happens when something unexpected is thrown inside a
 * check. Neither is reachable by handing `parseSettledArtifactV2` a file, since
 * one needs a value the file format cannot express and the other needs a
 * failure that is not the file's fault at all.
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
  type ArtifactEvidenceRowV2,
  assertEvidenceMatchesLedger,
  assertRowsCoherent,
} from '../../dist/final/node/index.mjs';

/**
 * Original of the slice every row here describes.
 */
const SOURCE_NAP = '猫猫在书店的阁楼里睡觉。';

/**
 * Archive's own English for it.
 */
const ARCHIVE_NAP = 'The cat sleeps in the bookshop attic.';

/**
 * Wording one lane decided on.
 */
const FRESH_NAP = 'The cat naps in the attic of the bookshop.';

/**
 * Different wording of the same length as {@link FRESH_NAP}, so a message that
 * distinguishes two decisions cannot do it by counting characters.
 */
const OTHER_NAP = 'The cat dozes in the attic of the bookshop';

/**
 * Path every message under test is built against.
 */
const LANE_PATH = 'lanes.translate';

/**
 * Row where the lane produced nothing and the archive's wording stands, which
 * both coherence rules accept.
 */
const RETAINED_ROW: ArtifactDeliveryRowV2 = {
  chunkIndex: 0,
  sourceText: SOURCE_NAP,
  incumbentKind: 'present',
  incumbentText: ARCHIVE_NAP,
  outcome: { kind: 'incumbent-fallback', },
  shippedText: ARCHIVE_NAP,
  delivery: { kind: 'incumbent-retained', },
};

await describe({
  name: 'assertRowsCoherent',
  children: [
    it({
      name:
        'ACCEPTS a row whose outcome and delivery can both be true, which is the control this file`s '
        + 'other cases are read against: a check that refused everything would look identical to one that '
        + 'refuses the right things',
      fn: () => {
        expect(() => {
          assertRowsCoherent({
            ledger: [RETAINED_ROW,],
            path: LANE_PATH,
          },);
        },).not
          .toThrow();
      },
    },),
    it({
      name:
        'REFUSES a row that reports a missing passage where the archive holds wording, naming the row`s '
        + 'position so a reader of a long ledger can find it',
      fn: () => {
        expect(() => {
          assertRowsCoherent({
            ledger: [
              RETAINED_ROW,
              {
                ...RETAINED_ROW,
                chunkIndex: 1,
                outcome: { kind: 'unfilled', },
              },
            ],
            path: LANE_PATH,
          },);
        },).toThrow('lanes.translate.delivery[1]',);
      },
    },),
    it({
      name:
        'RETHROWS an error that is not a coherence refusal instead of reporting it as a malformed row: a '
        + 'defect in this reader dressed as an artifact refusal sends an operator to archive a run that '
        + 'was fine, and buries the real fault under a message about the file',
      fn: () => {
        /**
         * Row that fails while being read rather than while being judged, which
         * is what a defect inside either coherence rule would look like from
         * here.
         */
        const unreadable: ArtifactDeliveryRowV2 = {
          ...RETAINED_ROW,
          get chunkIndex(): never {
            throw new RangeError('reader defect, not a fact about the file',);
          },
        };

        try {
          assertRowsCoherent({
            ledger: [unreadable,],
            path: LANE_PATH,
          },);
          throw new Error('the check returned instead of letting the reader defect out',);
        } catch (error) {
          // BY TYPE, not by text: the wrapper quotes whatever it caught, so a
          // message match cannot tell a rethrown error from a relabelled one.
          expect(error instanceof RangeError,).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: 'assertEvidenceMatchesLedger',
  children: [
    it({
      name:
        'NAMES BOTH KINDS when the raw result and the ledger disagree about what the lane did',
      fn: () => {
        /**
         * Raw result saying the lane decided a wording here.
         */
        const evidence: readonly ArtifactEvidenceRowV2[] = [
          {
            chunkIndex: 0,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: FRESH_NAP,
            },
          },
        ];

        expect(() => {
          assertEvidenceMatchesLedger({
            evidence,
            ledger: [RETAINED_ROW,],
            path: LANE_PATH,
          },);
        },).toThrow('decided rather than incumbent-fallback',);
      },
    },),
    it({
      name:
        'says WHAT DIFFERS rather than repeating one kind twice when both sides name the same member and '
        + 'carry different wording, since `decided rather than decided` states a disagreement and then '
        + 'refuses to say what it is',
      fn: () => {
        /**
         * Raw result and ledger that agree on the member and not on the wording.
         */
        const evidence: readonly ArtifactEvidenceRowV2[] = [
          {
            chunkIndex: 0,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: FRESH_NAP,
            },
          },
        ];

        /**
         * Ledger row deciding different wording, shipped as a replacement.
         */
        const ledger: readonly ArtifactDeliveryRowV2[] = [
          {
            ...RETAINED_ROW,
            outcome: {
              kind: 'decided',
              acceptedText: OTHER_NAP,
            },
            shippedText: OTHER_NAP,
            delivery: { kind: 'replacement-shipped', },
          },
        ];

        expect(() => {
          assertEvidenceMatchesLedger({
            evidence,
            ledger,
            path: LANE_PATH,
          },);
        },).toThrow('both name decided, and they differ in what that member carries',);
      },
    },),
  ],
},);
