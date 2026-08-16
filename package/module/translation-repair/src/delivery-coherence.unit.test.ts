/**
 * Tests for the rule tying a delivery to the rest of its row.
 *
 * WHAT THESE PIN is the four-case matrix a row has to satisfy whoever built it.
 * `buildSliceDelivery` decides these cases and can only produce coherent ones,
 * and it is not the only way a row reaches a consumer: the type is exported,
 * the comparison takes ledgers from a caller, and an artifact reader takes them
 * from disk. At each of those, the builder's guarantee is somebody else's
 * assumption, and a row that contradicts itself is well formed in every field.
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
  assertDeliveryCoherent,
  DeliveryCoherenceError,
  type SliceDeliveryRecord,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the slice these cases use.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Wording a lane might decide instead.
 */
const REWRITE = 'The cat is asleep on the windowsill.';

/**
 * Builds one row from the parts each case varies.
 *
 * @param outcome - what the lane did
 *
 * @param shippedText - what the document carries
 *
 * @param delivery - how it came to carry it
 *
 * @param incumbentKind - whether the archive holds wording here
 *
 * @returns Row shaped as a delivery ledger holds one
 *
 * @example
 * ```ts
 * const record = rowOf({ outcome, shippedText, delivery, },);
 * ```
 */
function rowOf(
  {
    outcome,
    shippedText,
    delivery,
    incumbentKind = 'present',
  }: {
    readonly outcome: SliceDeliveryRecord['outcome'];
    readonly shippedText: string;
    readonly delivery: SliceDeliveryRecord['delivery'];
    readonly incumbentKind?: 'present' | 'absent';
  },
): SliceDeliveryRecord {
  return {
    chunkIndex: 2,
    sourceText: '猫猫在窗台上睡觉。',
    incumbentKind,
    incumbentText: (incumbentKind === 'absent') ? '' : ARCHIVE_NAP,
    outcome,
    shippedText,
    delivery,
  };
}

await describe({
  name: assertDeliveryCoherent.name,
  children: [
    it({
      name:
        'accepts each of the four deliveries in the only shape it can take: a shipped replacement '
        + 'carrying what was decided, a withdrawn one carrying the archive, a retained incumbent, and a '
        + 'gap where the archive never had wording',
      fn: async () => {
        /**
         * One coherent row per delivery.
         */
        const coherent = [
          rowOf({
            outcome: {
              kind: 'decided',
              acceptedText: REWRITE,
            },
            shippedText: REWRITE,
            delivery: { kind: 'replacement-shipped', },
          },),
          rowOf({
            outcome: {
              kind: 'decided',
              acceptedText: REWRITE,
            },
            shippedText: ARCHIVE_NAP,
            delivery: {
              kind: 'replacement-withdrawn',
              reason: 'assembly-integrity',
            },
          },),
          rowOf({
            outcome: { kind: 'incumbent-fallback', },
            shippedText: ARCHIVE_NAP,
            delivery: { kind: 'incumbent-retained', },
          },),
          rowOf({
            outcome: { kind: 'unfilled', },
            shippedText: '',
            delivery: { kind: 'gap-remains', },
            incumbentKind: 'absent',
          },),
        ];
        for (const record of coherent)
          assertDeliveryCoherent({ record, },);
      },
    },),
    it({
      name:
        'REFUSES a shipped replacement with no decision behind it, since the delivery names a wording the '
        + 'lane is not reporting and the document would carry English nobody chose',
      fn: async () => {
        expect(function shippedNothing() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: { kind: 'not-evaluated', },
              shippedText: REWRITE,
              delivery: { kind: 'replacement-shipped', },
            },),
          },);
        },).toThrow(DeliveryCoherenceError,);
      },
    },),
    it({
      name:
        'REFUSES a replacement whose wording is the archive`s own, because nothing was replaced: the '
        + 'document reads exactly as it did and a count of shipped changes would include a slice nobody '
        + 'changed',
      fn: async () => {
        expect(function replacedNothing() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: {
                kind: 'decided',
                acceptedText: ARCHIVE_NAP,
              },
              shippedText: ARCHIVE_NAP,
              delivery: { kind: 'replacement-shipped', },
            },),
          },);
        },).toThrow('nothing was replaced',);
      },
    },),
    it({
      name:
        'REFUSES a shipped row carrying text that is neither the decision nor the archive, which is the '
        + 'state where no field says what the reader is actually looking at',
      fn: async () => {
        expect(function carriedSomethingElse() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: {
                kind: 'decided',
                acceptedText: REWRITE,
              },
              shippedText: 'A cat dozes in the window.',
              delivery: { kind: 'replacement-shipped', },
            },),
          },);
        },).toThrow('not the one that delivery carries',);
      },
    },),
    it({
      name:
        'REFUSES a withdrawn row that carries the withdrawn wording anyway, since a withdrawal is exactly '
        + 'the claim that the document does NOT have it',
      fn: async () => {
        expect(function withdrewAndShipped() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: {
                kind: 'decided',
                acceptedText: REWRITE,
              },
              shippedText: REWRITE,
              delivery: {
                kind: 'replacement-withdrawn',
                reason: 'assembly-integrity',
              },
            },),
          },);
        },).toThrow('not the one that delivery carries',);
      },
    },),
    it({
      name:
        'REFUSES a retained incumbent hiding a decision to change it, because that is a replacement with '
        + 'nothing saying what took it back: a reader counting withdrawals would miss it and a reader '
        + 'counting keeps would count it',
      fn: async () => {
        expect(function hidAChange() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: {
                kind: 'decided',
                acceptedText: REWRITE,
              },
              shippedText: ARCHIVE_NAP,
              delivery: { kind: 'incumbent-retained', },
            },),
          },);
        },).toThrow('saying what took the decision back',);
      },
    },),
    it({
      name:
        'REFUSES a retained incumbent where the archive holds none, and a gap where it holds wording, '
        + 'which are the two ways a row can disagree with the archive about which of them it describes',
      fn: async () => {
        expect(function retainedNothing() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: { kind: 'not-evaluated', },
              shippedText: '',
              delivery: { kind: 'incumbent-retained', },
              incumbentKind: 'absent',
            },),
          },);
        },).toThrow('where the archive holds none',);
        expect(function gappedSomething() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: { kind: 'not-evaluated', },
              shippedText: ARCHIVE_NAP,
              delivery: { kind: 'gap-remains', },
            },),
          },);
        },).toThrow('a gap where the archive holds wording',);
      },
    },),
    it({
      name:
        'REFUSES a gap that carries wording anyway, since the passage is either missing or it is not, and '
        + 'a gap row with text in it is the state a reader counting untranslated passages would trust',
      fn: async () => {
        expect(function gapWithText() {
          assertDeliveryCoherent({
            record: rowOf({
              outcome: { kind: 'unfilled', },
              shippedText: 'The cat has a bowl of its own.',
              delivery: { kind: 'gap-remains', },
              incumbentKind: 'absent',
            },),
          },);
        },).toThrow('carries wording anyway',);
      },
    },),
  ],
},);
