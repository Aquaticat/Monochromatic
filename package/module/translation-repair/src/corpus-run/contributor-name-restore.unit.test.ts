/**
 Guards class sixty-seven (2026-09-19): a contributor's name in a section
 heading was translated word for word while the archive renders the same
 person's signature as the handle the human translator knew, and one lane
 even rewrote the archive's handle in the signature into a transliteration. A name the original signs with is a person; the page renders it
 one way everywhere, the archive's way when the archive carries the
 signature, else the page's own signature rendering. Cat-themed invention
 throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { restoreContributorNames, } from '../../dist/final/node/index.mjs';
import { pair, } from './title-reference.test-fixture.ts';

/**
 A section the archive carries: the heading names the signer, the archive
 knows the signer's handle.
 */
const CARRIED = pair({
  sliceIndex: 0,
  source: '### 其三：猫猫\n\n它睡了。\n\n> <p style="text-align: end;">——猫猫, 2024 年 12 月 17 日</p>',
  target: '### Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>',
});

/**
 A section the archive never translated: the page's own signature rendering
 is the name.
 */
const UNCARRIED = pair({
  sliceIndex: 1,
  source: '### 其十：锦猫\n\n它醒了。\n\n<p style="text-align: end;">——锦猫, 2025 年 2 月 10 日</p>',
  target: '',
});

/**
 A signer the original never heads a section with, signed twice, whom the
 archive never rendered (class eighty-three).
 */
const SIGNED_TWICE = pair({
  sliceIndex: 2,
  source: '它唱了。\n\n<p style="text-align: end;">—— 云猫【白日梦】《七彩梦境》</p>\n\n它又唱了。\n\n<p style="text-align: end;">—— 云猫【白日梦】《午后猫语》</p>',
  target: '',
});

/**
 Two sections in one slice: the first heading names the signer, the second
 names no one.
 */
const TWO_SECTIONS = pair({
  sliceIndex: 3,
  source: '### 其三：猫猫\n\n它睡了。\n\n> <p style="text-align: end;">——猫猫, 2024 年 12 月 17 日</p>\n\n'
    + '### 其四：狗狗\n\n它跑了。',
  target: '### Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>\n\n'
    + '### Doggo\n\nIt runs.',
});

await describe({
  name: 'a contributor name is rendered one way across headings and signatures (class sixty-seven)',
  children: [
    it({
      name: 'RESTORES the archive\'s handle into a heading translated word for word and into a respelt signature',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [CARRIED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Three: Cat Cat\n\nIt sleeps.\n\n> <p style="text-align: end;">—Mao Mao, December 17, 2024</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('### Three: Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">—Maomao, December 17, 2024</p>',);
        expect(restored.restored.length,).toBe(1,);
        expect(restored.findings.length,).toBe(2,);
      },
    },),
    it({
      name: 'USES the page\'s own signature rendering where the archive never carried the section',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [UNCARRIED,],
          replacements: [{
            sliceIndex: 1,
            replacementText: '### Ten: Brocade Cat\n\nIt wakes.\n\n<p style="text-align: end;">—Jinmao, February 10, 2025</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('### Ten: Jinmao\n\nIt wakes.\n\n<p style="text-align: end;">—Jinmao, February 10, 2025</p>',);
      },
    },),
    it({
      name: 'LEAVES a page whose names already agree untouched',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [CARRIED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Three: Maomao\n\nIt dozes.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>',
          },],
        },);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
      },
    },),
    it({
      name: 'ROMANISES a handle the archive never rendered when the page leaves it in Han: one capitalised '
        + 'word of pinyin in the heading and the signature (class eighty-three, 2026-09-22: one handle '
        + 'shipped in Han in a heading and signature where earlier runs wrote two different pinyin spellings). '
        + 'The pinyin only: the literal meaning the owner\'s rule adds belongs to the gloss pass, which has none '
        + 'to place when no writer glossed the handle (ledger A17)',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [UNCARRIED,],
          replacements: [{
            sliceIndex: 1,
            replacementText: '### Ten: 锦猫\n\nIt wakes.\n\n<p style="text-align: end;">— 锦猫, February 10, 2025</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('### Ten: Jinmao\n\nIt wakes.\n\n<p style="text-align: end;">— Jinmao, February 10, 2025</p>',);
        expect(restored.findings.length,).toBe(2,);
        expect(restored.findings.every(function namesPinyin(finding,): boolean {
          return finding.includes('the pinyin reading of the original\'s handle',);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES a heading carrying the rendering with its literal meaning in parentheses, and takes the '
        + 'rendering without the parenthetical as the page\'s authority (class eighty-three)',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [UNCARRIED,],
          replacements: [{
            sliceIndex: 1,
            replacementText: '### Ten: Jinmao (Brocade Cat)\n\nIt wakes.\n\n<p style="text-align: end;">—Jinmao, February 10, 2025</p>',
          },],
        },);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
      },
    },),
    it({
      name: 'RENDERS a signer no heading names one way across the page: the second signature takes the first '
        + 'signature\'s rendering, and a signature left in Han takes the pinyin (class eighty-three: one '
        + 'signer shipped in pinyin on one song attribution and in Han on the next)',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [SIGNED_TWICE,],
          replacements: [{
            sliceIndex: 2,
            replacementText: 'It sang.\n\n<p style="text-align: end;">—— Yun Mao【Daydream】“Rainbow Dreamland”</p>\n\nIt sang again.\n\n<p style="text-align: end;">—— 云猫【Daydream】《Wu Hou Mao Yu》</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('It sang.\n\n<p style="text-align: end;">—— Yun Mao【Daydream】“Rainbow Dreamland”</p>\n\nIt sang again.\n\n<p style="text-align: end;">—— Yun Mao【Daydream】《Wu Hou Mao Yu》</p>',);
        expect(restored.findings.length,).toBe(1,);
      },
    },),
    it({
      name: 'LEAVES THE HEADINGS OF A SLICE WHOSE PAGE DROPPED ONE OF THEM AS THE PAGE HAS THEM: pairing the page\'s '
        + 'headings with the original\'s titles by position once wrote the signer\'s name over the next '
        + 'section\'s title (ledger B84)',
      fn: async () => {
        /**
         What the page writes for the two sections, the first heading dropped.
         */
        const dropped = {
          sliceIndex: 3,
          replacementText: 'It sleeps.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>\n\n'
            + '### Four: Doggo\n\nIt runs.',
        };
        const restored = restoreContributorNames({
          slices: [TWO_SECTIONS,],
          replacements: [dropped,],
        },);
        expect(restored,).toEqual({
          replacements: [dropped,],
          restored: [],
          findings: [],
        },);
      },
    },),
  ],
},);
