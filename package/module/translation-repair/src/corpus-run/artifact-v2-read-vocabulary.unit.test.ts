/**
 * Tests for reading version 2's unions and rows back off disk.
 *
 * WHAT THESE PIN is the schema-ownership rule, which decides where reading is
 * strict and where it is tolerant. Version 2 owns the ledger and the
 * comparison, so a key it does not name there means a file this reader cannot
 * read. The raw lane results belong to the live pipeline, which has added
 * fields before and will again, so a key version 2 does not name THERE is
 * evidence a later lane recorded and not a later version of this artifact.
 *
 * The pair that is easy to get wrong sits in the middle: inside a raw result, a
 * field version 2 never heard of is tolerated, while `acceptedText` on an
 * outcome that decided nothing is refused. One is a later pipeline adding
 * evidence; the other is this version's own vocabulary used to say something it
 * cannot mean.
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
  parseComparisonRowV2,
  parseDecisionComparisonV2,
  parseDeliveryRowV2,
  parseEvidenceRowV2,
  parseSliceDeliveryV2,
  parseSliceOutcomeV2,
} from '../../dist/final/node/index.mjs';

/**
 * Archive wording every fixture here shares.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

await describe({
  name: parseSliceOutcomeV2.name,
  children: [
    it({
      name:
        'reads every member this version describes, and carries a decision`s wording back with it',
      fn: async () => {
        expect(parseSliceOutcomeV2({
          value: {
            kind: 'decided',
            acceptedText: ARCHIVE_NAP,
          },
          unknownKeys: 'refuse',
          path: 'outcome',
        },),).toEqual({
          kind: 'decided',
          acceptedText: ARCHIVE_NAP,
        },);
        expect([
          'not-evaluated',
          'unfilled',
          'incumbent-fallback',
          'not-applicable',
        ].map(function readKind(kind,): unknown {
          return parseSliceOutcomeV2({
            value: { kind, },
            unknownKeys: 'refuse',
            path: 'outcome',
          },);
        },),).toEqual([
          { kind: 'not-evaluated', },
          { kind: 'unfilled', },
          { kind: 'incumbent-fallback', },
          { kind: 'not-applicable', },
        ],);
      },
    },),
    it({
      name:
        'REFUSES a discriminator this version cannot project, under BOTH key policies: a member named '
        + 'here that version 2 never described has no reading at all, and taking the row anyway would '
        + 'record a slice under a name this reader invented',
      fn: async () => {
        expect(function unknownKind() {
          parseSliceOutcomeV2({
            value: { kind: 'napped-through-it', },
            unknownKeys: 'refuse',
            path: 'outcome',
          },);
        },).toThrow('outcome.kind',);
        expect(function unknownKindTolerated() {
          parseSliceOutcomeV2({
            value: { kind: 'napped-through-it', },
            unknownKeys: 'tolerate',
            path: 'outcome',
          },);
        },).toThrow('outcome.kind',);
      },
    },),
    it({
      name:
        'TOLERATES a field version 2 never described where the live pipeline owns the shape, and REFUSES '
        + 'the same field where version 2 owns it: one is a later lane recording evidence, the other is a '
        + 'file this version cannot read',
      fn: async () => {
        expect(parseSliceOutcomeV2({
          value: {
            kind: 'decided',
            acceptedText: ARCHIVE_NAP,
            confidence: 0.5,
          },
          unknownKeys: 'tolerate',
          path: 'outcome',
        },),).toEqual({
          kind: 'decided',
          acceptedText: ARCHIVE_NAP,
        },);
        expect(function strictHere() {
          parseSliceOutcomeV2({
            value: {
              kind: 'decided',
              acceptedText: ARCHIVE_NAP,
              confidence: 0.5,
            },
            unknownKeys: 'refuse',
            path: 'outcome',
          },);
        },).toThrow('outcome.confidence',);
      },
    },),
    it({
      name:
        'REFUSES a RESERVED field on a member that has no meaning for it, even while tolerating unknown '
        + 'ones: an outcome that decided nothing cannot carry the wording it decided, and reading past '
        + 'that would hand a caller a wording no lane chose',
      fn: async () => {
        expect(function misplacedText() {
          parseSliceOutcomeV2({
            value: {
              kind: 'not-evaluated',
              acceptedText: ARCHIVE_NAP,
            },
            unknownKeys: 'tolerate',
            path: 'outcome',
          },);
        },).toThrow('outcome.acceptedText',);
        expect(function misplacedTextOnFallback() {
          parseSliceOutcomeV2({
            value: {
              kind: 'incumbent-fallback',
              acceptedText: ARCHIVE_NAP,
            },
            unknownKeys: 'tolerate',
            path: 'outcome',
          },);
        },).toThrow('decided nothing',);
      },
    },),
    it({
      name:
        'REFUSES a decision carrying no wording, which is the one field a member of this union owns',
      fn: async () => {
        expect(function noText() {
          parseSliceOutcomeV2({
            value: { kind: 'decided', },
            unknownKeys: 'refuse',
            path: 'outcome',
          },);
        },).toThrow('outcome.acceptedText',);
      },
    },),
  ],
},);

await describe({
  name: parseSliceDeliveryV2.name,
  children: [
    it({
      name: 'reads every member, and a withdrawal`s mechanism with it',
      fn: async () => {
        expect(parseSliceDeliveryV2({
          value: {
            kind: 'replacement-withdrawn',
            reason: 'assembly-integrity',
          },
          path: 'delivery',
        },),).toEqual({
          kind: 'replacement-withdrawn',
          reason: 'assembly-integrity',
        },);
        expect(parseSliceDeliveryV2({
          value: { kind: 'gap-remains', },
          path: 'delivery',
        },),).toEqual({ kind: 'gap-remains', },);
      },
    },),
    it({
      name:
        'REFUSES a withdrawal whose mechanism this version does not name, and a reason on a member that '
        + 'took nothing back: both would let a reader report a withdrawal that never happened',
      fn: async () => {
        expect(function unknownReason() {
          parseSliceDeliveryV2({
            value: {
              kind: 'replacement-withdrawn',
              reason: 'the-cat-said-no',
            },
            path: 'delivery',
          },);
        },).toThrow('delivery.reason',);
        expect(function reasonWithoutWithdrawal() {
          parseSliceDeliveryV2({
            value: {
              kind: 'incumbent-retained',
              reason: 'assembly-integrity',
            },
            path: 'delivery',
          },);
        },).toThrow('delivery.reason',);
      },
    },),
  ],
},);

await describe({
  name: parseDecisionComparisonV2.name,
  children: [
    it({
      name: 'reads both members, and keeps `undecidedLanes` in the order the file names them',
      fn: async () => {
        expect(parseDecisionComparisonV2({
          value: {
            kind: 'not-comparable',
            undecidedLanes: [
              'translate',
              'repair',
            ],
          },
          path: 'decisionComparison',
        },),).toEqual({
          kind: 'not-comparable',
          undecidedLanes: [
            'translate',
            'repair',
          ],
        },);
        expect(parseDecisionComparisonV2({
          value: {
            kind: 'comparable',
            verdict: 'different',
          },
          path: 'decisionComparison',
        },),).toEqual({
          kind: 'comparable',
          verdict: 'different',
        },);
      },
    },),
    it({
      name:
        'REFUSES a lane name this pipeline has no lane for, at the position that named it, since a third '
        + 'lane is a generation this reader cannot describe rather than a typo to skip past',
      fn: async () => {
        expect(function unknownLane() {
          parseDecisionComparisonV2({
            value: {
              kind: 'not-comparable',
              undecidedLanes: [
                'repair',
                'proofread',
              ],
            },
            path: 'decisionComparison',
          },);
        },).toThrow('decisionComparison.undecidedLanes[1]',);
      },
    },),
    it({
      name:
        'ACCEPTS an EMPTY undecided list, which is a fact about the writer rather than about this reader: '
        + 'the relations check whether the list agrees with the two outcomes, and a parser that refused '
        + 'it here would report a shape error for a disagreement',
      fn: async () => {
        expect(parseDecisionComparisonV2({
          value: {
            kind: 'not-comparable',
            undecidedLanes: [],
          },
          path: 'decisionComparison',
        },),).toEqual({
          kind: 'not-comparable',
          undecidedLanes: [],
        },);
      },
    },),
  ],
},);

await describe({
  name: parseDeliveryRowV2.name,
  children: [
    it({
      name: 'reads a whole ledger row, unions included',
      fn: async () => {
        expect(parseDeliveryRowV2({
          value: {
            chunkIndex: 0,
            sourceText: '猫猫在窗台上睡觉。',
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: ARCHIVE_NAP,
            },
            shippedText: ARCHIVE_NAP,
            delivery: { kind: 'incumbent-retained', },
          },
          path: 'lanes.repair.delivery[0]',
        },),).toEqual({
          chunkIndex: 0,
          sourceText: '猫猫在窗台上睡觉。',
          incumbentKind: 'present',
          incumbentText: ARCHIVE_NAP,
          outcome: {
            kind: 'decided',
            acceptedText: ARCHIVE_NAP,
          },
          shippedText: ARCHIVE_NAP,
          delivery: { kind: 'incumbent-retained', },
        },);
      },
    },),
    it({
      name:
        'REFUSES a key version 2 does not name on the row, and a slice index that is not a slice index: '
        + 'a fraction, a negative, or a value past what JSON carries exactly names no slice any '
        + 'preparation produced',
      fn: async () => {
        /**
         * One valid row, which each case below breaks in exactly one way.
         */
        const row = {
          chunkIndex: 0,
          sourceText: '猫猫在窗台上睡觉。',
          incumbentKind: 'present',
          incumbentText: ARCHIVE_NAP,
          outcome: { kind: 'not-applicable', },
          shippedText: ARCHIVE_NAP,
          delivery: { kind: 'incumbent-retained', },
        };
        expect(function extraKey() {
          parseDeliveryRowV2({
            value: {
              ...row,
              whiskers: 3,
            },
            path: 'row',
          },);
        },).toThrow('row.whiskers',);
        expect([
          1.5,
          -1,
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.MAX_SAFE_INTEGER + 2,
        ].map(function refusesIndex(chunkIndex,): string {
          try {
            parseDeliveryRowV2({
              value: {
                ...row,
                chunkIndex,
              },
              path: 'row',
            },);
            return 'accepted';
          } catch (error) {
            // The NAME rather than a boolean, so a case that fails some other
            // way reads as that failure instead of as a refusal.
            return Error.isError(error,) ? error.name : 'threw a non-error';
          }
        },),).toEqual([
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
        ],);
      },
    },),
  ],
},);

await describe({
  name: parseComparisonRowV2.name,
  children: [
    it({
      name: 'reads a whole comparison row, all four unions and the verdict included',
      fn: async () => {
        /**
         * One row saying both lanes moved to different wordings.
         */
        const row = {
          chunkIndex: 2,
          incumbentKind: 'present',
          incumbentText: ARCHIVE_NAP,
          repairText: 'The cat is asleep on the sill.',
          translateText: 'The cat naps on the windowsill.',
          verdict: 'both-differ',
          repairOutcome: {
            kind: 'decided',
            acceptedText: 'The cat is asleep on the sill.',
          },
          translateOutcome: {
            kind: 'decided',
            acceptedText: 'The cat naps on the windowsill.',
          },
          decisionComparison: {
            kind: 'comparable',
            verdict: 'different',
          },
          repairDelivery: { kind: 'replacement-shipped', },
          translateDelivery: { kind: 'replacement-shipped', },
        };
        expect(parseComparisonRowV2({
          value: row,
          path: 'comparison[0]',
        },),).toEqual(row,);
      },
    },),
    it({
      name:
        'REFUSES a verdict this version does not name, so a generation that added one cannot be read as '
        + 'though its rows meant what these do',
      fn: async () => {
        expect(function unknownVerdict() {
          parseComparisonRowV2({
            value: {
              chunkIndex: 0,
              incumbentKind: 'absent',
              incumbentText: '',
              repairText: '',
              translateText: '',
              verdict: 'both-napped',
              repairOutcome: { kind: 'not-applicable', },
              translateOutcome: { kind: 'unfilled', },
              decisionComparison: {
                kind: 'not-comparable',
                undecidedLanes: [
                  'repair',
                  'translate',
                ],
              },
              repairDelivery: { kind: 'gap-remains', },
              translateDelivery: { kind: 'gap-remains', },
            },
            path: 'comparison[0]',
          },);
        },).toThrow('comparison[0].verdict',);
      },
    },),
  ],
},);

await describe({
  name: parseEvidenceRowV2.name,
  children: [
    it({
      name:
        'takes the four fields version 2 checks out of a raw slice row and LEAVES THE REST, so a lane '
        + 'that records more evidence next month does not make today`s artifacts unreadable',
      fn: async () => {
        expect(parseEvidenceRowV2({
          value: {
            chunkIndex: 1,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: ARCHIVE_NAP,
            },
            ballots: [{ voter: 'Tabby', },],
            elapsedMs: 12,
          },
          path: 'lanes.repair.result.sliceTexts[1]',
        },),).toEqual({
          chunkIndex: 1,
          incumbentKind: 'present',
          incumbentText: ARCHIVE_NAP,
          outcome: {
            kind: 'decided',
            acceptedText: ARCHIVE_NAP,
          },
        },);
      },
    },),
    it({
      name:
        'still REQUIRES the four, since they are what the ledger is checked against: a raw row missing '
        + 'one of them leaves the check with nothing to compare and would pass by having less',
      fn: async () => {
        expect(function noIncumbentKind() {
          parseEvidenceRowV2({
            value: {
              chunkIndex: 1,
              incumbentText: ARCHIVE_NAP,
              outcome: { kind: 'unfilled', },
            },
            path: 'sliceTexts[1]',
          },);
        },).toThrow('sliceTexts[1].incumbentKind',);
      },
    },),
  ],
},);
