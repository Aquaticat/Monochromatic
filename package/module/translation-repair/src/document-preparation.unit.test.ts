/**
 * Tests for the lane-neutral preparation both drivers slice from.
 *
 * The property that matters is that ONE document pair yields ONE slicing. Two
 * lanes preparing separately would each report slices that look right on their
 * own, and nothing downstream could tell that a repair outcome and a translate
 * outcome for "slice 4" described different spans.
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

import { prepareDocumentPair, } from '../dist/final/node/index.mjs';

/**
 * Original with front matter declaring a name, and two sections.
 */
const SOURCE_TEXT = `---
name: 猫猫
handle: mao
---

## 第一节

猫猫喜欢追蝴蝶。

猫猫也喜欢晒太阳。

## 第二节

窗台上有一只鸟。
`;

/**
 * Translation of the same document, section for section.
 */
const TARGET_TEXT = `---
name: Maomao
handle: mao
---

## Section one

The cat likes chasing butterflies.

The cat also likes sunbathing.

## Section two

There is a bird on the windowsill.
`;

await describe({
  name: prepareDocumentPair.name,
  children: [
    it({
      name: 'pairs the sections and carries COMPLETE chunk spans, offsets and '
        + 'text on both sides, since a lane reading only the text would splice '
        + 'its result back over the wrong span',
      fn: async () => {
        const { slices, alignmentPairCount, } = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        expect(alignmentPairCount,).toBeGreaterThan(0,);
        expect(slices.length,).toBeGreaterThanOrEqual(alignmentPairCount,);
        for (const slice of slices) {
          expect(SOURCE_TEXT.slice(
            slice.source
              .startOffset,
            slice.source
              .endOffset,
          ),).toBe(slice.source
            .text,);
          expect(TARGET_TEXT.slice(
            slice.target
              .startOffset,
            slice.target
              .endOffset,
          ),).toBe(slice.target
            .text,);
        }
      },
    },),

    it({
      name: 'indexes slices GLOBALLY and in document order, which is what lets '
        + 'a cached outcome and a spliced replacement name the same slice. '
        + 'Per-section indexes would collide the moment any section subdivided',
      fn: async () => {
        const { slices, } = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        expect(slices.map(function toIndex(slice,): number {
          return slice.target
            .chunkIndex;
        },),).toEqual(slices.map(function toPosition(
          _unused,
          position,
        ): number {
          return position;
        },),);
      },
    },),

    it({
      name: 'collects declared names from BOTH sides, which no slice text '
        + 'carries: front matter is document-level, so this is the only path by '
        + 'which a declared correspondence reaches a prompt',
      fn: async () => {
        const { identityContext, } = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        expect(identityContext,).toContain('猫猫',);
        expect(identityContext,).toContain('Maomao',);
      },
    },),

    it({
      name: 'OMITS the identity block when neither side declares anything, '
        + 'rather than passing an empty one, so a prompt never carries a '
        + 'heading with nothing under it',
      fn: async () => {
        expect(prepareDocumentPair({
          sourceText: '## 第一节\n\n猫猫喜欢追蝴蝶。\n',
          targetText: '## Section one\n\nThe cat likes chasing butterflies.\n',
        },).identityContext,).toBeUndefined();
      },
    },),

    it({
      name: 'reports alignment findings in scorecard-stable wording when the '
        + 'two sides disagree structurally, since those findings are how a '
        + 'wrongly paired document is recognised afterwards',
      fn: async () => {
        const { alignmentFindings, } = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          // One section short, which is the shape that made a whole document
          // pair off by one in the corpus.
          targetText: `## Section one

The cat likes chasing butterflies.

The cat also likes sunbathing.
`,
        },);
        expect(alignmentFindings.length,).toBeGreaterThan(0,);
        for (const finding of alignmentFindings)
          expect(finding.startsWith('alignment ',),).toBe(true,);
      },
    },),

    it({
      name: 'GIVES THE SAME SLICING EVERY TIME for one pair, which is the '
        + 'whole reason preparation is shared: two lanes that sliced separately '
        + 'would drift the moment either changed a budget, and each would still '
        + 'report slices that look right on their own',
      fn: async () => {
        expect(prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },),).toEqual(prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },),);
      },
    },),

    it({
      name: 'inherits the line-structure verdict from the enclosing CHUNK, so '
        + 'a verse section subdividing into short slices does not lose the rule '
        + 'on the slices that need it most',
      fn: async () => {
        /**
         * Verse-shaped section: many short lines, which is what the predicate
         * reads.
         */
        const verse = `## 诗

猫猫走过屋顶
月亮照在窗台
风吹过树梢
夜里没有声音
猫猫回到家中
`;
        const { slices, lineStructuredSliceIndices, } = prepareDocumentPair({
          sourceText: verse,
          targetText: `## Verse

The cat walks the roof
The moon lights the sill
Wind moves the branches
No sound in the night
The cat comes home
`,
        },);
        // Either every slice of a governed chunk is governed or none is; what
        // must never happen is an index that belongs to no slice.
        for (const index of lineStructuredSliceIndices) {
          expect(slices.some(function hasIndex(slice,): boolean {
            return slice.target
              .chunkIndex === index;
          },),).toBe(true,);
        }
      },
    },),

    it({
      name: 'KEEPS THE SCORER for a section the roster agreed nothing for',
      fn: async () => {
        // ONE section, long enough that the 400-character budget subdivides it.
        // The shared fixture cannot show this: its sections each fit in a
        // single slice, so a collapsed section and a properly sliced one look
        // identical and the case would pass however the code read an empty map.
        const source = '## 一节\n\n'
          + `${'猫猫在窗台上看鸟，看了整整一个下午，尾巴一直轻轻摆动。'.repeat(3,)}\n\n`
          + `${'傍晚的时候，猫猫跳下窗台，走到门口等着有人回家。'.repeat(3,)}\n\n`
          + `${'第二天早上，猫猫又回到窗台，那只鸟已经不在那里了。'.repeat(3,)}\n`;
        const target = '## One\n\n'
          + `${'The cat watched the birds from the sill all afternoon, her tail moving. '.repeat(3,)}\n\n`
          + `${'Towards evening she jumped down and waited by the door for someone. '.repeat(3,)}\n\n`
          + `${'Next morning she returned to the sill, and the bird had gone. '.repeat(3,)}\n`;

        /**
         * Reads a slicing as the spans it carries, which is what a later stage
         * sees; counts alone would pass a slicing that moved every boundary.
         *
         * @param prepared - preparation to read
         *
         * @returns One span per slice, in slice order
         *
         * @example
         * ```ts
         * const spans = spansOf(prepared,);
         * ```
         */
        function spansOf(prepared: ReturnType<typeof prepareDocumentPair>,): readonly string[] {
          return prepared.slices
            .map(function toSpan(slice,): string {
              return `${String(slice.target.startOffset,)}..${String(slice.target.endOffset,)}`;
            },);
        }

        /**
         * How the deterministic aligner slices this pair.
         */
        const scorer = prepareDocumentPair({
          sourceText: source,
          targetText: target,
        },);

        // POSITIVE CONTROL, and the reason the fixture is this long: the ONE
        // section has to subdivide, or a collapse into a single slice is
        // indistinguishable from correct slicing.
        expect(scorer.slices.length,).toBeGreaterThan(1,);

        // What the roster agreeing nothing for a section produces: a map that
        // is present and holds no entry for it. The pairing stage records that
        // as falling back to scoring, so it has to slice exactly as the scorer
        // does rather than reading the miss as an empty pairing.
        const unpaired = prepareDocumentPair({
          sourceText: source,
          targetText: target,
          blockPairings: new Map(),
        },);

        expect(spansOf(unpaired,),).toStrictEqual(spansOf(scorer,),);
      },
    },),
  ],
},);
