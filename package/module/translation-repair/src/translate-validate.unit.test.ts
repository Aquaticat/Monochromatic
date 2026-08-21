/**
 * Tests for the structural comparison between a translated slice and its
 * original.
 *
 * What this can and cannot claim is the whole design, so the cases are chosen
 * to pin both edges. It compares what survives a translation, meaning block
 * structure, footnote markers, link and image destinations, and inline code. It
 * says nothing about wording, and the numbers-and-names atoms that
 * `inspect-paragraph.ts` protects are deliberately absent here, because 三只猫
 * becomes "three cats" and no digit survives on either side.
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

    it({
      name: 'ACCEPTS a rendering shaped like the PAGE where the page merges '
        + 'what the original splits, which is the case that made the source '
        + 'anchor send six good renderings back to their authors',
      fn: async () => {
        expect(
          validateTranslatedSlice({
            sourceText: '猫猫在窗台上打盹。\n\n（邻居留）',
            pageText: '> The cat dozes on the windowsill.\n\n—left by a neighbour',
            candidateText: '> The cat naps on the windowsill.\n\n—left by a neighbour',
          },).kind,
        ).toBe('valid',);
      },
    },),

    it({
      name: 'REFUSES a rendering shaped like the ORIGINAL when the page it '
        + 'replaces is shaped otherwise, since the block quote is what says '
        + 'somebody left this passage rather than wrote it',
      fn: async () => {
        /**
         * Verdict where the candidate keeps the original's shape and loses the
         * page's.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。\n\n（邻居留）',
          pageText: '> The cat dozes on the windowsill.\n\n—left by a neighbour',
          candidateText: 'The cat naps on the windowsill.\n\nLeft by a neighbour.',
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('PAGE AS IT STANDS',);
      },
    },),

    it({
      name: 'ACCEPTS a rendering that RESTORES a block the page left out, '
        + 'which the page-as-ceiling rule deleted again on the next round',
      fn: async () => {
        expect(
          validateTranslatedSlice({
            sourceText: '猫猫在窗台上打盹。\n\n> 邻居说它每天都来。',
            pageText: 'The cat dozes on the windowsill.',
            candidateText: 'The cat dozes on the windowsill.\n\n> The neighbour '
              + 'says it comes every day.',
          },).kind,
        ).toBe('valid',);
      },
    },),

    it({
      name: 'REFUSES a block neither the page nor the original carries, so '
        + 'restoring stays restoring rather than becoming licence to invent',
      fn: async () => {
        /**
         * Verdict where the candidate adds a block from nowhere.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。',
          pageText: 'The cat dozes on the windowsill.',
          candidateText: 'The cat dozes on the windowsill.\n\nIt is a tabby.',
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('Add a block only to carry',);
      },
    },),

    it({
      name: 'KEEPS a footnote the PAGE carries and the original never had, '
        + 'because accurate detail the archive added is not a candidate\'s to '
        + 'drop',
      fn: async () => {
        /**
         * Verdict where the candidate carries the page's own footnote.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。',
          pageText: 'The cat dozes on the windowsill[^1].\n\n[^1]: The sill '
            + 'faces east.',
          candidateText: 'The cat naps on the windowsill[^1].\n\n[^1]: The sill '
            + 'faces east.',
        },);
        expect(validation.kind,).toBe('valid',);
      },
    },),

    it({
      name: 'REPORTS a footnote the page carries and the candidate dropped, '
        + 'naming both references so the model knows which text asked for it',
      fn: async () => {
        /**
         * Verdict where the candidate drops the page's footnote.
         */
        const validation = validateTranslatedSlice({
          sourceText: '猫猫在窗台上打盹。',
          pageText: 'The cat dozes on the windowsill[^1].\n\n[^1]: The sill '
            + 'faces east.',
          candidateText: 'The cat naps on the windowsill.',
        },);
        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid') ? validation.findings.join('\n',) : '',
        ).toContain('ORIGINAL or the PAGE AS IT STANDS',);
      },
    },),

    it({
      name: 'FALLS BACK to the original alone when the page refuses the strict '
        + 'grammar, since an archive written before this grammar existed is '
        + 'not the candidate\'s fault',
      fn: async () => {
        expect(
          validateTranslatedSlice({
            sourceText: '猫猫在窗台上打盹。',
            pageText: 'The cat dozes {unclosed on the windowsill.',
            candidateText: 'The cat naps on the windowsill.',
          },).kind,
        ).toBe('valid',);
      },
    },),
  ],
},);
