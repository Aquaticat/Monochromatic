/**
 * Tests for reading what the third rendering settled over one document.
 *
 * THE SHIPPED FIELD IS WHAT THESE ARE ABOUT. Every other field an artifact
 * carries is evidence about a decision; `shipped` is the decision's OUTPUT, and
 * a consumer writes its text into the document. So the two directions of
 * disagreement between it and the terminal each get a case: a record claiming
 * text on a terminal that changed nothing would ship a passage nobody settled
 * on, and one claiming no change on the consolidated terminal would silently
 * drop a passage the roster did settle on.
 *
 * THE ABSENCE HAS TWO MEANINGS and both are pinned. Every artifact settled
 * before this field existed carries no key at all, and a reader that read that
 * as "the pass declined to ask" would count the whole earlier archive as
 * declines. Measured before these were written: six settled artifacts from four
 * earlier runs all read, all six report `unrecorded`, none refused.
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

import { parseConsolidationV2, } from '../../dist/final/node/index.mjs';

/**
 * Path every case reports its refusals under.
 */
const AT = 'whiskers.consolidation';

/**
 * One slice as the driver records a consolidation that shipped.
 */
const SHIPPED_SLICE = {
  chunkIndex: 0,
  terminal: 'consolidated',
  shipped: {
    kind: 'consolidated',
    text: 'The cat naps in the window.\nShe wakes at four.',
  },
  rewrapped: true,
  demoted: false,
  verdicts: [
    {
      modelId: 'hf:cat/Cat-A',
      kind: 'valid',
      findings: [],
    },
  ],
  gate: {
    kind: 'asked',
    ballots: [
      {
        choice: 'consolidated',
        unsupported: [],
        unsupportedRaw: [],
        dropped: ['standing',],
        droppedRaw: ['the standing text drops the hour she wakes',],
        reason: 'the consolidation keeps both',
      },
    ],
    usable: 1,
  },
};

/**
 * One slice as the driver records a slate the floor refused.
 */
const FLOORED_SLICE = {
  chunkIndex: 1,
  terminal: 'incumbent-only',
  shipped: { kind: 'unchanged', },
  rewrapped: false,
  demoted: false,
  verdicts: [],
  gate: { kind: 'not-asked', },
};

/**
 * Reads a consolidation field, reporting the refusal rather than raising it.
 *
 * @param value - field as an artifact would carry it
 *
 * @returns What was parsed, or the refusal text
 *
 * @example
 * ```ts
 * const read = readingOf({ value, },);
 * ```
 */
function readingOf({ value, }: { readonly value: unknown; },): {
  readonly kind: string;
  readonly reason: string;
} {
  try {
    return {
      kind: parseConsolidationV2({
        value,
        path: AT,
      },).kind,
      reason: '',
    };
  }
  catch (error: unknown) {
    return {
      kind: 'refused',
      reason: String(error,),
    };
  }
}

await describe({
  name: parseConsolidationV2.name,
  children: [
    it({
      name: 'READS AN ABSENT FIELD AS UNRECORDED rather than as a pass that declined to ask. Every '
        + 'artifact settled before this field existed carries no key at all, and reading that as a '
        + 'decline would count the whole earlier archive as one. Six real artifacts from four earlier '
        + 'runs were read this way before this case was written',
      fn: async () => {
        expect(readingOf({ value: undefined, },).kind,).toBe('unrecorded',);
      },
    },),

    it({
      name: 'KEEPS A STATED DECLINE APART FROM THAT ABSENCE, so a pass that ran only the two lanes is '
        + 'a decision somebody recorded rather than a field nobody wrote',
      fn: async () => {
        expect(readingOf({ value: { kind: 'not-run', }, },).kind,).toBe('not-run',);
      },
    },),

    it({
      name: 'READS A SETTLED STAGE with a consolidation that shipped and a slate the floor refused, '
        + 'which is the positive control: a parser refusing everything would pass every case below '
        + 'while making the field unreadable',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              SHIPPED_SLICE,
              FLOORED_SLICE,
            ],
          },
        },);

        expect(read.reason,).toBe('',);
        expect(read.kind,).toBe('settled',);
      },
    },),

    it({
      name: 'REFUSES TEXT FROM A SLICE THAT SETTLED ON NO CHANGE, which would write a passage into '
        + 'the document that no round decided on. The terminal and the shipped kind answer the same '
        + 'question, so a record disagreeing with itself about it is not a record of anything',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              {
                ...SHIPPED_SLICE,
                terminal: 'gate-kept-standing',
              },
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('settled on no change',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A CONSOLIDATED SLICE CARRYING NO TEXT, which is the same disagreement the other '
        + 'way round and the more dangerous one: the roster settled on a rendering and the record '
        + 'offers nothing to write, so the passage silently keeps wording the gate rejected',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              {
                ...SHIPPED_SLICE,
                shipped: { kind: 'unchanged', },
              },
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('must carry the text it ships',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A TERMINAL THIS VERSION DOES NOT NAME, since the terminal is what a census '
        + 'counts and what decides whether the slice ships, so one nothing can read makes both '
        + 'unanswerable',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              {
                ...FLOORED_SLICE,
                terminal: 'kept-it-i-guess',
              },
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('terminal',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES TWO RECORDS NAMING ONE SLICE, following the contest reader for the reason #113 '
        + 'gave: the driver writes one record per contested slice, so two are two answers to one '
        + 'question, and a consumer keying by chunkIndex would keep whichever it read last',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              FLOORED_SLICE,
              FLOORED_SLICE,
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('appears more than once',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A GATE WHOSE USABLE COUNT DISAGREES WITH ITS BALLOTS, mirroring the contest '
        + 'reader: that count is what the quorum reads, so a record claiming six voices behind one '
        + 'ballot describes a panel that never sat',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              {
                ...SHIPPED_SLICE,
                gate: {
                  ...SHIPPED_SLICE.gate,
                  usable: 6,
                },
              },
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('usable',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A BALLOT NAMING A RENDERING THAT DOES NOT EXIST, because the evidence fields are '
        + 'read as choices rather than as prose. #164 found the gate shipping a rendering its own '
        + 'ballots named faultier because nothing counted them, and a name outside the three would be '
        + 'counted as nothing and weaken that evidence silently',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [
              {
                ...SHIPPED_SLICE,
                gate: {
                  kind: 'asked',
                  usable: 1,
                  ballots: [
                    {
                      ...SHIPPED_SLICE.gate.ballots[0],
                      dropped: ['the other one',],
                    },
                  ],
                },
              },
            ],
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('consolidated, standing, neither',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A KEY THIS VERSION DOES NOT NAME, so a field added by a later schema and read by '
        + 'this one is a refusal rather than a silent drop, which is the property every other reader '
        + 'in this generation already holds',
      fn: async () => {
        const read = readingOf({
          value: {
            kind: 'settled',
            slices: [FLOORED_SLICE,],
            heardTranslators: 5,
          },
        },);

        expect(read.kind,).toBe('refused',);
        expect(read.reason.includes('heardTranslators',),).toBe(true,);
      },
    },),
  ],
},);
