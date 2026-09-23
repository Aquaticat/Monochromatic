/**
 Guards class one hundred (XingZ630, 2026-09-23): a section title the
 original writes once as a heading and again in brackets (a linked credit,
 a footnote's 「title」篇, a song credit's 《title》) reached the page in two
 English renderings, "Bird in a Cage" over "The Caged Bird" and "Zero-Layer
 Prayer" over "Zero-Degree Prayer", because each slice is judged alone. The
 page decides once, where every heading is in view: a reference to a
 heading takes the heading's rendering. Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  unifyTitleReferences,
} from '../../dist/final/node/index.mjs';

/**
 One slice.

 @param sliceIndex - where the slice stands

 @param source - original text

 @param target - archive text, empty where the archive never translated it

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, source: '### 笼中猫', target: '', },);
 ```
 */
function pair(
  {
    sliceIndex,
    source,
    target,
  }: {
    readonly sliceIndex: number;
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 Two headings the archive never rendered, referenced by a link, a
 footnote, a bracketed credit and a glossed credit.
 */
const SLICES: readonly ChunkPair[] = [
  pair({
    sliceIndex: 0,
    source: '<h3 align = "center">笼中猫</h3>',
    target: '',
  },),
  pair({
    sliceIndex: 1,
    source: '——出自《[笼中猫](https://example.test/cat)》',
    target: '',
  },),
  pair({
    sliceIndex: 2,
    source: '### 零重猫愿',
    target: '',
  },),
  pair({
    sliceIndex: 3,
    source: '[^6]: 见后文「零重猫愿」篇开头。',
    target: '',
  },),
  pair({
    sliceIndex: 4,
    source: '—— 雨猫《零重猫愿》',
    target: '',
  },),
  pair({
    sliceIndex: 5,
    source: '—— 雨猫【梦】《零重猫愿》',
    target: '',
  },),
  pair({
    sliceIndex: 6,
    source: '[^5]: 出自《猫经》。\n\n[^6]: 见后文「零重猫愿」篇开头。',
    target: '',
  },),
];

/**
 Renderings of the two headings.
 */
const HEADINGS = [
  {
    sliceIndex: 0,
    replacementText: '<h3 align = "center">Cat in a Cage</h3>',
  },
  {
    sliceIndex: 2,
    replacementText: '### Zero-Layer Cat Prayer',
  },
] as const;

await describe({
  name: 'a reference to a section heading (class one hundred)',
  children: [
    it({
      name: 'UNIFIES a linked, a quoted, a bracketed, a glossed and a footnote-tail reference to the heading\'s rendering',
      fn: async () => {
        /**
         Pass over a page whose references each rendered the title afresh.
         */
        const unified = unifyTitleReferences({
          slices: SLICES,
          replacements: [
            ...HEADINGS,
            {
              sliceIndex: 1,
              replacementText: '——From [The Caged Cat](https://example.test/cat)',
            },
            {
              sliceIndex: 3,
              replacementText: '[^6]: See the beginning of the section “Zero-Degree Cat Prayer”.',
            },
            {
              sliceIndex: 4,
              replacementText: '—— Yumao 《Zero Cat Prayer》',
            },
            {
              sliceIndex: 5,
              replacementText: '—— Yumao, from “Dream,” Zero-Degree Cat Prayer (零重猫愿)',
            },
            {
              sliceIndex: 6,
              replacementText: '[^5]: From “The Cat Sutra”.\n\n[^6]: See the section “Zero-Degree Cat Prayer”.',
            },
          ],
        },);
        expect(unified.replacements.map(function textOf(row,): string {
          return row.replacementText;
        },),).toEqual([
          '<h3 align = "center">Cat in a Cage</h3>',
          '### Zero-Layer Cat Prayer',
          '——From [Cat in a Cage](https://example.test/cat)',
          '[^6]: See the beginning of the section “Zero-Layer Cat Prayer”.',
          '—— Yumao 《Zero-Layer Cat Prayer》',
          '—— Yumao, from “Dream,” Zero-Layer Cat Prayer (零重猫愿)',
          '[^5]: From “The Cat Sutra”.\n\n[^6]: See the section “Zero-Layer Cat Prayer”.',
        ],);
        expect(unified.restored.length,).toBe(5,);
        expect(unified.findings.join('\n',),).toContain(
          'title-reference-unified (slice 3: "Zero-Degree Cat Prayer" to "Zero-Layer Cat Prayer"',
        );
      },
    },),
    it({
      name: 'LEAVES a reference already rendered as the heading, one the archive alone carries, and one it cannot place',
      fn: async () => {
        /**
         Pass over a page whose link already matches, whose footnote is the
         archive's own, and whose credit quotes two things.
         */
        const unified = unifyTitleReferences({
          slices: [
            ...SLICES.slice(
              0,
              3,
            ),
            pair({
              sliceIndex: 3,
              source: '[^6]: 见后文「零重猫愿」篇开头。',
              target: '[^6]: See the section “Zero-Degree Cat Prayer”.',
            },),
            ...SLICES.slice(
              4,
              6,
            ),
          ],
          replacements: [
            ...HEADINGS,
            {
              sliceIndex: 1,
              replacementText: '——From [Cat in a Cage](https://example.test/cat)',
            },
            {
              sliceIndex: 4,
              replacementText: '—— Yumao, “Zero Cat Prayer,” from “Dream”',
            },
          ],
        },);
        expect(unified.restored,).toEqual([],);
        expect(unified.findings.join('\n',),).toContain('title-reference-ambiguous (slice 4',);
        expect(unified.findings.length,).toBe(1,);
      },
    },),
  ],
},);
