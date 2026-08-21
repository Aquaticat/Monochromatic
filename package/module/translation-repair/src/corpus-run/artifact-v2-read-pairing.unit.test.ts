/**
 * Tests for reading the pairing a settled preparation was built on.
 *
 * WHAT THESE PIN is the difference between an artifact that records no pairing
 * and one that records an empty one, and the four shapes the reader refuses
 * because this pipeline cannot write them. Each refusal mirrors an invariant
 * `readBlockPairing` already holds over a roster reply, so a refusal that fired
 * on a shape the producer CAN emit would reject valid artifacts, which is the
 * failure these are pointed at rather than laxness.
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

import { parseBlockPairingV2, } from '../../dist/final/node/index.mjs';

/**
 * Sections a fixture may name, wide enough that no case is bounded by accident.
 */
const ALIGNED_SECTIONS = 4;

await describe({
  name: parseBlockPairingV2.name,
  children: [
    it({
      name:
        'NAMES ABSENCE rather than returning an empty list, because a file written before the field and '
        + 'a roster asked about every section that agreed nothing are different facts about a run',
      fn: async () => {
        expect(parseBlockPairingV2({
          value: undefined,
          alignmentPairCount: ALIGNED_SECTIONS,
          path: 'Whiskers.preparation.blockPairing',
        },),).toEqual({ kind: 'unrecorded', },);
      },
    },),
    it({
      name:
        'ACCEPTS a recorded pairing that names no sections, which is the answer when the roster was asked '
        + 'and committed to nothing anywhere, and is NOT the same reading as an absent field',
      fn: async () => {
        expect(parseBlockPairingV2({
          value: [],
          alignmentPairCount: ALIGNED_SECTIONS,
          path: 'Whiskers.preparation.blockPairing',
        },),).toEqual({
          kind: 'stored',
          sections: [],
        },);
      },
    },),
    it({
      name:
        'ACCEPTS a split and a merge, which are the shapes this corpus actually carries: one original '
        + 'rendered as two blocks repeats the source, and two originals rendered as one repeat the target',
      fn: async () => {
        expect(parseBlockPairingV2({
          value: [
            {
              sectionIndex: 0,
              pairs: [
                {
                  source: 0,
                  target: 0,
                },
                {
                  source: 0,
                  target: 1,
                },
              ],
            },
            {
              sectionIndex: 2,
              pairs: [
                {
                  source: 0,
                  target: 0,
                },
                {
                  source: 1,
                  target: 0,
                },
              ],
            },
          ],
          alignmentPairCount: ALIGNED_SECTIONS,
          path: 'Whiskers.preparation.blockPairing',
        },).kind,).toBe('stored',);
      },
    },),
    it({
      name:
        'REFUSES a section index the preparation beside it never aligned, the way each lane index set is '
        + 'bounded by the slice count: a pairing filed under a section nobody aligned describes another document',
      fn: async () => {
        expect(function pastTheEnd() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: ALIGNED_SECTIONS,
                pairs: [],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0].sectionIndex',);
      },
    },),
    it({
      name:
        'REFUSES a section named twice, since the writer builds the list from a map keyed by section and '
        + 'cannot emit one, so a repeat means two runs merged into a file neither wrote',
      fn: async () => {
        expect(function twice() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 1,
                pairs: [],
              },
              {
                sectionIndex: 1,
                pairs: [],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('rather than 1 again',);
      },
    },),
    it({
      name:
        'REFUSES sections out of recorded order rather than sorting them, because the writer sorts and '
        + 'quietly reordering would accept the file while hiding which run produced it',
      fn: async () => {
        expect(function backwards() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 2,
                pairs: [],
              },
              {
                sectionIndex: 1,
                pairs: [],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('a section above 2',);
      },
    },),
    it({
      name:
        'REFUSES a pairing that walks backwards on either side, which the roster reply reader already '
        + 'refuses: both documents say things in the same order',
      fn: async () => {
        expect(function backOnTheOriginal() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [
                  {
                    source: 2,
                    target: 0,
                  },
                  {
                    source: 1,
                    target: 1,
                  },
                ],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('on both sides',);
        expect(function backOnTheTranslation() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [
                  {
                    source: 0,
                    target: 2,
                  },
                  {
                    source: 1,
                    target: 1,
                  },
                ],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('on both sides',);
      },
    },),
    it({
      name:
        'REFUSES a correspondence made twice in one section, which repeats an answer rather than giving '
        + 'a new one, and which the roster reply reader refuses for the same reason',
      fn: async () => {
        expect(function repeated() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [
                  {
                    source: 1,
                    target: 1,
                  },
                  {
                    source: 1,
                    target: 1,
                  },
                ],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('does not already make',);
      },
    },),
    it({
      name:
        'REFUSES a key this version does not name, on the section and on the pair alike, so a field from '
        + 'a later generation cannot be read as one this reader understands',
      fn: async () => {
        expect(function extraOnSection() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [],
                whiskers: 3,
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0].whiskers',);
        expect(function extraOnPair() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [
                  {
                    source: 0,
                    target: 0,
                    confidence: 1,
                  },
                ],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0].pairs[0].confidence',);
      },
    },),
    it({
      name:
        'REFUSES a fractional or negative index on either side, since every index here counts blocks and '
        + 'a fraction means the writer and this reader disagree about what the field holds',
      fn: async () => {
        expect(function fractional() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: 0,
                pairs: [
                  {
                    source: 1.5,
                    target: 0,
                  },
                ],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0].pairs[0].source',);
        expect(function negative() {
          parseBlockPairingV2({
            value: [
              {
                sectionIndex: -1,
                pairs: [],
              },
            ],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0].sectionIndex',);
      },
    },),
    it({
      name:
        'REFUSES anything that is not a list of records, so a pairing written as an object keyed by '
        + 'section reaches no reader as an empty one',
      fn: async () => {
        expect(function notAList() {
          parseBlockPairingV2({
            value: { 0: [], },
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('Whiskers.preparation.blockPairing',);
        expect(function notARecord() {
          parseBlockPairingV2({
            value: ['paired',],
            alignmentPairCount: ALIGNED_SECTIONS,
            path: 'Whiskers.preparation.blockPairing',
          },);
        },).toThrow('[0]',);
      },
    },),
  ],
},);
