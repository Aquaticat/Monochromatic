/**
 * Tests for the structural comparison between a translated slice and its
 * original.
 *
 * What this can and cannot claim is the whole design, so the cases are chosen
 * to pin both edges. It compares what survives a translation, meaning block
 * structure, footnote markers, link and image destinations, and inline code. It
 * says nothing about wording, and the numbers-and-names atoms that
 * `inspect-paragraph.ts` protects are deliberately absent here, because 三封信
 * becomes "three letters" and no digit survives on either side.
 *
 * Findings are written for the MODEL that produced the candidate rather than
 * for a log, since an invalid candidate is handed back to its author rather
 * than dropped, so the cases assert on what those sentences say.
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

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 * Original carrying a heading, a paragraph with a footnote marker, and that
 * footnote's definition.
 */
const SOURCE_TEXT = `## 猫猫的一天

早上它在窗台上打盹[^1]。

[^1]: 窗台朝东。`;

await describe({
  name: validateTranslatedSlice.name,
  children: [
    it({
      name: 'accepts a translation that carries the same blocks and the same '
        + 'markers, which is the case that must stay quiet: a validator that '
        + 'fired on ordinary work would send every candidate back to its '
        + 'author and double the lane',
      fn: async () => {
        expect(
          validateTranslatedSlice({
            sourceText: SOURCE_TEXT,
            candidateText: `## A Day in the Cat's Life

In the morning it dozes on the windowsill[^1].

[^1]: The windowsill faces east.`,
          },).kind,
        ).toBe('valid',);
      },
    },),

    it({
      name: 'REPORTS a translation that merged the original heading into its '
        + 'prose, naming both shapes. The translator sheet asks for one block '
        + 'per original block, so a merge is the model not doing what it was '
        + 'asked rather than a rendering choice',
      fn: async () => {
        /**
         * Verdict over a candidate that dropped the heading level.
         */
        const validation = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: `A Day in the Cat's Life. In the morning it dozes on the windowsill[^1].

[^1]: The windowsill faces east.`,
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('heading (level 2)',);
      },
    },),

    it({
      name: 'REPORTS a footnote marker the translation dropped, which reads '
        + 'perfectly well to a judge and breaks the document: the definition '
        + 'is left pointing at nothing once the slice is spliced back in',
      fn: async () => {
        /**
         * Verdict over a candidate that dropped the reference but kept the
         * definition.
         */
        const validation = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: `## A Day in the Cat's Life

In the morning it dozes on the windowsill.

[^1]: The windowsill faces east.`,
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('footnote 1',);
      },
    },),

    it({
      name: 'REPORTS a link the translation invented, since a destination is '
        + 'not something a rendering can supply: it came from the model rather '
        + 'than from the passage',
      fn: async () => {
        /**
         * Verdict over a candidate carrying a link the original never had.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。',
          candidateText: 'The [cat](https://cats.example/naps) dozes on the windowsill.',
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('https://cats.example/naps',);
      },
    },),

    it({
      name: 'ignores where a link MOVED to, because a translation reorders '
        + 'clauses legitimately and a destination shifting within a sentence '
        + 'is not damage. Comparing atoms in order rather than as a multiset '
        + 'would refuse ordinary work',
      fn: async () => {
        expect(
          validateTranslatedSlice({
            sourceText: '见[窗台](https://a.example)和[暖气片](https://b.example)。',
            candidateText: 'See the [radiator](https://b.example) and the [windowsill](https://a.example).',
          },).kind,
        ).toBe('valid',);
      },
    },),

    it({
      name: 'answers UNKNOWN rather than invalid when the ORIGINAL cannot be '
        + 'parsed, since that says nothing about the candidate and charging it '
        + 'to the model would send a good translation back for a fault in the '
        + 'passage it was given',
      fn: async () => {
        /**
         * Verdict where the original itself refuses the strict grammar.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫 <未闭合 的标签 在这里。',
          candidateText: 'The cat dozes on the windowsill.',
        },);
        expect(validation.kind,).toBe('unknown',);
      },
    },),

    it({
      name: 'REPORTS a candidate the parser refuses, and hands the parser\'s '
        + 'own account back, so the model is told what to fix rather than that '
        + 'something was wrong',
      fn: async () => {
        /**
         * Verdict where the candidate refuses the strict grammar.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。',
          candidateText: 'The cat dozes {unclosed on the windowsill.',
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('could not be parsed',);
      },
    },),
  ],
},);
