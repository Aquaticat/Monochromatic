/**
 Guards class forty-four (Mio27, 2026-09-17): a candidate that carries one of
 the sheet's own evidence blocks, copied from the writer's sheet, is refused
 before any judge reads it. Cat-themed invention throughout; no corpus content
 appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  sheetLeakFindings,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original with a picture component and a rule below it.
 */
const SOURCE = `<PhotoScroll photos={[\n'\${path}/photos/cat1.webp'\n]} />\n\n---`;

/**
 Rendering that copied the sheet's transcript block after the component.
 */
const LEAKED = `${SOURCE}\n\n===== WHAT THE PICTURES HERE SAY =====\nPICTURE cat1.webp\nreader-one:\n[left] 猫在睡觉`;

await describe({
  name: 'sheet evidence copied into a candidate (class forty-four)',
  children: [
    ...[
      'WHAT THE PICTURES HERE SAY',
      'ATTESTED DETAILS',
      'CITED REFERENCES',
      'EXISTING TRANSLATION',
    ].map(function refusesLabel(label,) {
      return it({
        name: `REFUSES a candidate carrying the sheet's ${label} block`,
        fn: async () => {
          const result = validateTranslatedSlice({
            sourceText: '猫在睡觉。',
            candidateText: `The cat is sleeping.\n\n===== ${label} =====\nsomething copied`,
          },);
          expect(result.kind,).toBe('invalid',);
          if (result.kind === 'invalid')
            expect(result.findings.join('\n',),).toContain(label,);
        },
      },);
    },),
    it({
      name: 'REFUSES the transcript block copied under a picture component, the Mio27 shape',
      fn: async () => {
        const result = validateTranslatedSlice({
          sourceText: SOURCE,
          pageText: SOURCE,
          candidateText: LEAKED,
        },);
        expect(result.kind,).toBe('invalid',);
        if (result.kind === 'invalid')
          expect(result.findings.join('\n',),).toContain('WHAT THE PICTURES HERE SAY',);
      },
    },),
    ...[
      'WHAT THE JUDGES FOUND, claims to check against the original',
      'PRIOR FAILED CONSOLIDATION STRATEGY',
      'REQUIRED FINDINGS from independent absolute-quality review',
      'PRIOR CORRECTION STRATEGIES THAT FAILED; choose a materially different approach',
      'ORIGINAL (Chinese), the standard',
      'SURROUNDING ORIGINAL (Chinese), context only',
      'REJECTED CANDIDATE 1',
      'A LABEL NO LIST NAMES YET',
    ].map(function refusesFenced(label,) {
      return it({
        name: `REFUSES the fenced "${label}" block (ledger F-8 and E7: the label list had fallen behind the sheets)`,
        fn: async () => {
          // THE FLOOR ITSELF, not the composed verdict: there the added block
          // is refused by the block comparison first, which says nothing
          // about whether this floor reads the label.
          expect(sheetLeakFindings({
            sourceText: '猫在睡觉。',
            pageText: 'The cat is sleeping.',
            candidateText: `The cat is sleeping.\n\n===== ${label} =====\n- the cat is asleep`,
          },).length,).toBeGreaterThan(0,);
        },
      },);
    },),
    it({
      name: 'REFUSES a sheet head copied without its fence, and ACCEPTS a setext underline and a fenced line the '
        + 'original and the page carry',
      fn: async () => {
        expect(sheetLeakFindings({
          sourceText: '猫在睡觉。',
          pageText: '',
          candidateText: 'The cat is sleeping.\n\nWHAT THE JUDGES FOUND: the cat is asleep.',
        },).length,).toBeGreaterThan(0,);
        expect(sheetLeakFindings({
          sourceText: '猫的日记\n=====\n\n猫在睡觉。',
          pageText: '',
          candidateText: 'The Cat\'s Diary\n=====\n\nThe cat is sleeping.',
        },),).toStrictEqual([],);
        expect(sheetLeakFindings({
          sourceText: '===== 猫 =====\n\n猫在睡觉。',
          pageText: '===== Cat =====\n\nThe cat is sleeping.',
          candidateText: '===== Cat =====\n\nThe cat is sleeping.',
        },),).toStrictEqual([],);
      },
    },),
    it({
      name: 'REFUSES the editor sheet\'s region marker and its unfenced line heads copied into a rendering, '
        + 'unless the original or the page carries them (ledger B24)',
      fn: async () => {
        for (const candidateText of [
          'The cat «REGION 3» is sleeping.',
          'CURRENT TEXT: The cat is sleeping.',
          'CONTEXT: ...the cat is sleeping...',
        ]) {
          /**
           What the chain refuses the rendering with.
           */
          const result = validateTranslatedSlice({
            sourceText: '猫在睡觉。',
            candidateText,
          },);
          expect(result.kind,).toBe('invalid',);
          expect((result.kind === 'invalid') ? result.findings.join(' ',) : '',).toContain('the sheet\'s own',);
        }
        expect(sheetLeakFindings({
          sourceText: '猫在睡觉。',
          pageText: 'CURRENT TEXT: The cat is sleeping.',
          candidateText: 'CURRENT TEXT: The cat is sleeping.',
        },),).toStrictEqual([],);
      },
    },),
    it({
      name: 'ACCEPTS a rendering that leaves the sheet blocks out',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '猫在睡觉。',
          candidateText: 'The cat is sleeping.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          pageText: SOURCE,
          candidateText: SOURCE,
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
