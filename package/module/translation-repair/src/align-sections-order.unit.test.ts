/**
 * Tests for order-preserving section alignment and the heading affinity that
 * drives it.
 * Fixtures mirror the corpus shape that motivated it; names are the real ones,
 * since the whole point is that handles survive translation.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  alignHeadings,
  headingAffinity,
  latinTokens,
} from '../dist/final/node/index.mjs';

/**
 * Original-side headings of the entry this was built from.
 */
const SOURCE_HEADINGS: readonly string[] = [
  '## 简介',
  '## 参与救助',
  '## 友人的回忆',
  '### 其一：伊良子',
  '### 其二：铃语',
  '### 其三：绘都',
  '### 其四：无常',
  '### 其五：东云',
  '### 其六：Mikä',
  '### 其七：wing',
  '### 其八：白毛 suki',
  '### 其九：空白',
  '### 其十：锦心',
  '## 致曾划过夜空的流星',
];

/**
 * Translation-side headings, two fewer, both missing near the end.
 */
const TARGET_HEADINGS: readonly string[] = [
  '## Introduction',
  '## Engagement in Trans Aid',
  '## Memories by Friends',
  '### Irako',
  '### Lingyu',
  '### HiYku',
  '### Ann',
  '### Shinonome',
  '### Mikä',
  '### wing',
  '### Baimao suki',
  '### __',
];

await describe({
  name: latinTokens.name,
  children: [
    it({
      name: 'pulls the handle out of a heading that is otherwise Chinese, which '
        + 'is the signal that survives translation in this archive',
      fn: async () => {
        expect([...latinTokens({ text: '### 其八：白毛 suki', },),],)
          .toEqual(['suki',],);
      },
    },),

    it({
      name: 'ignores runs shorter than three letters, since initials and markup '
        + 'fragments match far too freely across unrelated headings',
      fn: async () => {
        expect([...latinTokens({ text: '### a b 其一', },),],).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: headingAffinity.name,
  children: [
    it({
      name: 'scores a shared handle at 1, which is what pairs 其七：wing with '
        + 'wing however far apart the aligner would otherwise place them',
      fn: async () => {
        expect(headingAffinity({
          source: '### 其七：wing',
          target: '### wing',
        },),).toBe(1,);
      },
    },),

    it({
      name: 'scores 0 when either heading offers no Latin run at all, because no '
        + 'evidence is not weak evidence and an aligner should say so rather '
        + 'than guess from a coincidence',
      fn: async () => {
        expect(headingAffinity({
          source: '### 其九：空白',
          target: '### Shinonome',
        },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: alignHeadings.name,
  children: [
    it({
      name: 'pairs every essay section correctly on the entry whose aligner slid '
        + 'by two. Proportional-by-character put 其六：Mikä against a section '
        + 'headed Ann while a section headed Mikä sat two places away, and every '
        + 'critic call on that entry then compared unrelated text',
      fn: async () => {
        /**
         * Steps keyed by source heading, for readable assertions.
         */
        const paired = new Map(
          alignHeadings({
            sourceHeadings: SOURCE_HEADINGS,
            targetHeadings: TARGET_HEADINGS,
          },)
            .filter(function isPaired(step,) {
              return (step.sourceIndex >= 0) && (step.targetIndex >= 0);
            },)
            .map(function toEntry(step,) {
              return [
                SOURCE_HEADINGS[step.sourceIndex],
                TARGET_HEADINGS[step.targetIndex],
              ] as const;
            },),
        );

        expect(paired.get('### 其一：伊良子',),).toBe('### Irako',);
        expect(paired.get('### 其二：铃语',),).toBe('### Lingyu',);
        expect(paired.get('### 其三：绘都',),).toBe('### HiYku',);
        expect(paired.get('### 其四：无常',),).toBe('### Ann',);
        expect(paired.get('### 其五：东云',),).toBe('### Shinonome',);
        expect(paired.get('### 其六：Mikä',),).toBe('### Mikä',);
        expect(paired.get('### 其七：wing',),).toBe('### wing',);
        expect(paired.get('### 其八：白毛 suki',),).toBe('### Baimao suki',);
      },
    },),

    it({
      name: 'leaves sections UNPAIRED rather than placing them somewhere, which '
        + 'is the whole difference from proportional distribution: that cannot '
        + 'express absence, so two sections missing from the end slid every '
        + 'earlier pairing instead of costing two gaps',
      fn: async () => {
        /**
         * Steps carrying a gap on one side.
         */
        const gaps = alignHeadings({
          sourceHeadings: SOURCE_HEADINGS,
          targetHeadings: TARGET_HEADINGS,
        },)
          .filter(function isGap(step,) {
            return (step.sourceIndex < 0) || (step.targetIndex < 0);
          },);

        expect(gaps.length,).toBe(SOURCE_HEADINGS.length - TARGET_HEADINGS.length,);
      },
    },),

    it({
      name: 'keeps document order, since a translation follows its original and '
        + 'a pairing that reorders sections would be evidence of a bug rather '
        + 'than of a translation',
      fn: async () => {
        /**
         * Source indices in the order the steps report them.
         */
        const order = alignHeadings({
          sourceHeadings: SOURCE_HEADINGS,
          targetHeadings: TARGET_HEADINGS,
        },)
          .filter(function isSourceSide(step,) {
            return step.sourceIndex >= 0;
          },)
          .map(function toIndex(step,) {
            return step.sourceIndex;
          },);

        expect(order,).toEqual(order.toSorted(function ascending(left, right,) {
          return left - right;
        },),);
      },
    },),

    it({
      name: 'leaves the gaps at the END when no heading carries any evidence. '
        + 'Every affinity is then zero, so every placement scores the same and '
        + 'the traceback alone chooses. Preferring the pairing put them at the '
        + 'FRONT, which slid every section by the count difference and so '
        + 'reproduced the exact defect this aligner exists to remove; XingZ60 '
        + 'hid it, because its Latin names anchor three pairs outright',
      fn: async () => {
        /**
         * Headings with no Latin run anywhere, so nothing can be matched.
         */
        const sourceHeadings: readonly string[] = [
          '## 一',
          '## 二',
          '## 三',
          '## 四',
          '## 五',
        ];

        /**
         * Two fewer, standing for a translation that stops early.
         */
        const targetHeadings: readonly string[] = [
          '## 甲',
          '## 乙',
          '## 丙',
        ];

        expect(
          alignHeadings({
            sourceHeadings,
            targetHeadings,
          },),
        ).toEqual([
          {
            sourceIndex: 0,
            targetIndex: 0,
            affinity: 0,
          },
          {
            sourceIndex: 1,
            targetIndex: 1,
            affinity: 0,
          },
          {
            sourceIndex: 2,
            targetIndex: 2,
            affinity: 0,
          },
          {
            sourceIndex: 3,
            targetIndex: (-1),
            affinity: 0,
          },
          {
            sourceIndex: 4,
            targetIndex: (-1),
            affinity: 0,
          },
        ],);
      },
    },),

    it({
      name: 'does the same when the extra sections sit on the TRANSLATION side, '
        + 'so neither direction slides. A translation carrying sections its '
        + 'original does not is the shape that put 613 characters of original '
        + 'against 9551 characters of English',
      fn: async () => {
        /**
         * Steps for a target longer than its source.
         */
        const steps = alignHeadings({
          sourceHeadings: [
            '## 甲',
            '## 乙',
            '## 丙',
          ],
          targetHeadings: [
            '## 一',
            '## 二',
            '## 三',
            '## 四',
            '## 五',
          ],
        },);

        expect(
          steps.filter(function isGap(step,) {
            return step.sourceIndex === (-1);
          },).length,
        ).toBe(2,);
        expect(steps.at(0,)?.sourceIndex,).toBe(0,);
        expect(steps.at(-1,)?.sourceIndex,).toBe(-1,);
      },
    },),

    it({
      name: 'lets a confident pairing beat the gap preference, since only exact '
        + 'ties reach the tie-break and a shared name scores strictly above a '
        + 'gap. Without this the new ordering would trade one sliding defect '
        + 'for another',
      fn: async () => {
        /**
         * A name shared across the boundary, sitting after unmatched headings.
         */
        const steps = alignHeadings({
          sourceHeadings: [
            '## 一',
            '## 二',
            '### 其六：Mikä',
          ],
          targetHeadings: [
            '## 甲',
            '### Mikä',
          ],
        },);

        /**
         * The step carrying the shared name.
         */
        const anchored = steps.find(function isAnchor(step,) {
          return step.affinity > 0;
        },);

        expect(anchored?.sourceIndex,).toBe(2,);
        expect(anchored?.targetIndex,).toBe(1,);
      },
    },),
  ],
},);
