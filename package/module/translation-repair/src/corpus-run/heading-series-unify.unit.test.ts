/**
 Guards class sixty-eight (XingZ616, 2026-09-19): the ten section headings
 `其一` to `其十` reached the page in seven ordinal styles ("One:", none,
 "IV:", "The Fifth:", "Part Six:", "IX:", "Ten:") because slices are judged
 one at a time and a parallel series has no one style. The page renders a
 numbered heading series in the style most of its headings took, the
 earliest style on a tie, and drops the ordinals where most headings
 dropped them. Class eighty-nine (XingZ624, 2026-09-23): where the archive
 renders the series itself, the page takes the archive's style, so the
 style no longer moves run to run on the slices' plurality. Cat-themed
 invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  unifyHeadingSeries,
} from '../../dist/final/node/index.mjs';

/**
 One slice carrying one heading of the series.

 @param sliceIndex - where the slice stands

 @param source - original heading

 @param target - archive heading, empty where the archive never headed the section

 @returns Prepared pair

 @example
 ```ts
 const slice = section({ sliceIndex: 0, source: '### 其一：橘猫', target: '### Ginger', },);
 ```
 */
function section(
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
      text: `${source}\n\n猫。`,
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: (target === '') ? 'Cat.' : `${target}\n\nCat.`,
    },
  };
}

/**
 Three numbered sections the archive never headed, so the renderings alone
 set the style.
 */
const SLICES: readonly ChunkPair[] = [
  section({
    sliceIndex: 0,
    source: '### 其一：橘猫',
    target: '',
  },),
  section({
    sliceIndex: 1,
    source: '### 其二：黑猫',
    target: '',
  },),
  section({
    sliceIndex: 2,
    source: '### 其三：白猫',
    target: '',
  },),
];

/**
 The same three sections as the archive heads them, without ordinals.
 */
const ARCHIVED: readonly ChunkPair[] = [
  section({
    sliceIndex: 0,
    source: '### 其一：橘猫',
    target: '### Ginger',
  },),
  section({
    sliceIndex: 1,
    source: '### 其二：黑猫',
    target: '### Sooty',
  },),
  section({
    sliceIndex: 2,
    source: '### 其三：白猫',
    target: '### Snowy',
  },),
];

/**
 The same three sections as an archive heads them with "Part" and a
 cardinal.
 */
const PARTED: readonly ChunkPair[] = [
  section({
    sliceIndex: 0,
    source: '### 其一：橘猫',
    target: '### Part One: Ginger',
  },),
  section({
    sliceIndex: 1,
    source: '### 其二：黑猫',
    target: '### Part Two: Sooty',
  },),
  section({
    sliceIndex: 2,
    source: '### 其三：白猫',
    target: '### Part Three: Snowy',
  },),
];

/**
 Replacement carrying one heading rendering.

 @param sliceIndex - slice replaced

 @param heading - rendered heading line

 @returns Replacement as the page would write it

 @example
 ```ts
 const row = rendered({ sliceIndex: 0, heading: '### One: Ginger', },);
 ```
 */
function rendered(
  {
    sliceIndex,
    heading,
  }: {
    readonly sliceIndex: number;
    readonly heading: string;
  },
): { readonly sliceIndex: number; readonly replacementText: string; } {
  return {
    sliceIndex,
    replacementText: `${heading}\n\nCat.`,
  };
}

/**
 Heading lines of the replacements, by slice order.

 @param replacements - what the page would write

 @returns First line of each replacement

 @example
 ```ts
 const lines = headingsOf({ replacements, },);
 ```
 */
function headingsOf(
  { replacements, }: { readonly replacements: readonly { readonly replacementText: string; }[]; },
): readonly string[] {
  return replacements.map(function firstLine(replacement,): string {
    return replacement.replacementText
      .split('\n',)[0] ?? '';
  },);
}

await describe({
  name: 'a numbered heading series takes one ordinal style (class sixty-eight, XingZ616)',
  children: [
    it({
      name: 'RENDERS every heading in the earliest style when the styles tie',
      fn: async () => {
        const unified = unifyHeadingSeries({
          slices: SLICES,
          replacements: [
            rendered({
              sliceIndex: 0,
              heading: '### One: Ginger',
            },),
            rendered({
              sliceIndex: 1,
              heading: '### Sooty',
            },),
            rendered({
              sliceIndex: 2,
              heading: '### III: Snowy',
            },),
          ],
        },);
        expect(headingsOf({ replacements: unified.replacements, },),).toEqual([
          '### One: Ginger',
          '### Two: Sooty',
          '### Three: Snowy',
        ],);
        expect(unified.findings.length,).toBe(2,);
      },
    },),
    it({
      name: 'DROPS the ordinals where most headings dropped them, the archive\'s convention',
      fn: async () => {
        const unified = unifyHeadingSeries({
          slices: SLICES,
          replacements: [
            rendered({
              sliceIndex: 0,
              heading: '### Ginger',
            },),
            rendered({
              sliceIndex: 1,
              heading: '### Sooty',
            },),
            rendered({
              sliceIndex: 2,
              heading: '### Part 3: Snowy',
            },),
          ],
        },);
        expect(headingsOf({ replacements: unified.replacements, },),).toEqual([
          '### Ginger',
          '### Sooty',
          '### Snowy',
        ],);
      },
    },),
    it({
      name: 'REACHES a heading the page carries from the archive alone by writing a replacement for it',
      fn: async () => {
        const unified = unifyHeadingSeries({
          slices: [
            SLICES[0] as ChunkPair,
            ARCHIVED[1] as ChunkPair,
            SLICES[2] as ChunkPair,
          ],
          replacements: [
            rendered({
              sliceIndex: 0,
              heading: '### The First: Ginger',
            },),
            rendered({
              sliceIndex: 2,
              heading: '### The Third: Snowy',
            },),
          ],
        },);
        expect(unified.replacements
          .find(function second(replacement,): boolean {
            return replacement.sliceIndex === 1;
          },)?.replacementText,).toBe('### The Second: Sooty\n\nCat.',);
      },
    },),
    it({
      name: 'TAKES THE ARCHIVE\'S STYLE where the archive renders the series (class eighty-nine, XingZ624, '
        + '2026-09-23): an archive without ordinals drops them from every heading whatever the renderings\' '
        + 'plurality, and an archive with "Part" and a cardinal writes that on every heading',
      fn: async () => {
        const dropped = unifyHeadingSeries({
          slices: ARCHIVED,
          replacements: [
            rendered({
              sliceIndex: 0,
              heading: '### One: Ginger',
            },),
            rendered({
              sliceIndex: 1,
              heading: '### Part Two: Sooty',
            },),
            rendered({
              sliceIndex: 2,
              heading: '### Part Three: Snowy',
            },),
          ],
        },);
        expect(headingsOf({ replacements: dropped.replacements, },),).toEqual([
          '### Ginger',
          '### Sooty',
          '### Snowy',
        ],);
        expect(dropped.findings[0],).toContain('the archive\'s own style',);
        const parted = unifyHeadingSeries({
          slices: PARTED,
          replacements: [
            rendered({
              sliceIndex: 0,
              heading: '### Ginger',
            },),
            rendered({
              sliceIndex: 1,
              heading: '### Sooty',
            },),
            rendered({
              sliceIndex: 2,
              heading: '### III: Snowy',
            },),
          ],
        },);
        expect(headingsOf({ replacements: parted.replacements, },),).toEqual([
          '### Part One: Ginger',
          '### Part Two: Sooty',
          '### Part Three: Snowy',
        ],);
      },
    },),
    it({
      name: 'LEAVES a page with fewer than two numbered headings alone',
      fn: async () => {
        const unified = unifyHeadingSeries({
          slices: [SLICES[0] as ChunkPair,],
          replacements: [rendered({
            sliceIndex: 0,
            heading: '### IX: Ginger',
          },),],
        },);
        expect(unified.findings,).toEqual([],);
        expect(unified.restored,).toEqual([],);
      },
    },),
  ],
},);
