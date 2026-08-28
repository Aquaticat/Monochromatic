/**
 * Tests explicit front matter slicing and structural translation validation.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FrontMatterAlignmentError,
  frontMatterRepairOutcome,
  frontMatterSlice,
  validateFrontMatterTranslation,
} from '../dist/final/node/index.mjs';

/**
 * Source metadata fixture.
 */
const SOURCE = {
  raw: '---\nname: 猫猫\ninfo:\n  alias: 猫\n---\n',
  data: {
    name: '猫猫',
    info: { alias: '猫', },
  },
};

/**
 * Target metadata fixture.
 */
const TARGET = {
  raw: '---\nname: Maomao\ninfo:\n  alias: Cat\n---\n',
  data: {
    name: 'Maomao',
    info: { alias: 'Cat', },
  },
};

await describe({
  name: frontMatterSlice.name,
  children: [
    it({
      name: 'CREATES EXPLICIT SLICE ZERO over exact source and target metadata bytes',
      fn: async () => {
        const result = frontMatterSlice({ source: SOURCE, target: TARGET, });
        expect(result.kind,).toBe('paired',);
        if (result.kind !== 'paired')
          throw new Error('expected paired front matter fixture',);
        expect(result.slice,).toEqual({
          syntax: 'front-matter',
          source: {
            kind: 'content',
            sliceIndex: 0,
            nodes: [],
            startOffset: 0,
            endOffset: SOURCE.raw.length,
            text: SOURCE.raw,
          },
          target: {
            kind: 'content',
            sliceIndex: 0,
            nodes: [],
            startOffset: 0,
            endOffset: TARGET.raw.length,
            text: TARGET.raw,
          },
        },);
      },
    },),

    it({
      name: 'RETURNS EXPLICIT NONE when neither document declares metadata',
      fn: async () => {
        expect(frontMatterSlice({},),).toEqual({ kind: 'none', },);
      },
    },),

    it({
      name: 'REFUSES PRESENCE MISMATCH instead of silently dropping or preserving one side',
      fn: async () => {
        expect(() => frontMatterSlice({ source: SOURCE, },),).toThrow(FrontMatterAlignmentError,);
        expect(() => frontMatterSlice({ target: TARGET, },),).toThrow(FrontMatterAlignmentError,);
      },
    },),
  ],
},);

await describe({
  name: frontMatterRepairOutcome.name,
  children: [
    it({
      name: 'EMITS EXPLICIT UNCHANGED REPAIR ROW so prose editors never touch YAML',
      fn: async () => {
        const outcome = frontMatterRepairOutcome({
          sliceIndex: 0,
          targetText: TARGET.raw,
        },);
        expect(outcome.changed,).toBe(false,);
        expect(outcome.repairedText,).toBe(TARGET.raw,);
        expect(outcome.findings,).toContain(
          'repair-front-matter-not-applicable (translate ensemble owns YAML metadata)',
        );
      },
    },),
  ],
},);

await describe({
  name: validateFrontMatterTranslation.name,
  children: [
    it({
      name: 'ACCEPTS TRANSLATED SCALARS under exact archive key and container shape',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          pageText: TARGET.raw,
          candidateText: '---\nname: Mao\ninfo:\n  alias: Kitty\n---\n',
        },).kind,).toBe('valid',);
      },
    },),

    it({
      name: 'REFUSES FIELD LOSS, BODY PROSE, AND MALFORMED YAML',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          pageText: TARGET.raw,
          candidateText: '---\nname: Mao\n---\n',
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          pageText: TARGET.raw,
          candidateText: `${TARGET.raw}explanation`,
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          pageText: TARGET.raw,
          candidateText: '---\nname: [broken\n---\n',
        },).kind,).toBe('invalid',);
      },
    },),
  ],
},);
