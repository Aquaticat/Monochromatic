/**
 Tests that a slice's window carries the footnote definitions the slice cites
 from outside it (ledger L5).

 WHY. A slice citing `[^1]` whose definition sits at the page end showed every
 sheet the marker and never the note, so an attribution the note carries read
 as dropped: 342 of 6,261 slices over every run cited a footnote defined
 outside the slice, and 85 issues the panel accepted there named a footnote,
 an attribution, a credit or a citation.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  parseDocument,
  sliceNeighbourContexts,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 Builds one prepared slice pair stamped with its position.

 @param sliceIndex - index this slice was stamped with

 @param source - original wording of the passage

 @param target - archive English of the same passage

 @returns Pair shaped as preparation returns one

 @example
 ```ts
 const slice = pairOf({ sliceIndex: 0, source: '猫睡了。', target: 'The cat slept.', },);
 ```
 */
function pairOf(
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
      sliceIndex,
      startOffset: 0,
      endOffset: source.length,
      text: source,
      nodes: parseDocument({ text: source, },).nodes,
    },
    target: {
      sliceIndex,
      startOffset: 0,
      endOffset: target.length,
      text: target,
      nodes: parseDocument({ text: target, },).nodes,
    },
  };
}

/**
 Original of the first note, two lines long.
 */
const SOURCE_NOTE_ONE = '[^1]: 摘自猫咪日记。\n    第二页。';

/**
 Archive English of the first note.
 */
const TARGET_NOTE_ONE = '[^1]: From the cat diary.\n    Page two.';

/**
 Five slices: the first cites note one, the fourth cites note two, the last
 defines both.
 */
const SLICES = [
  pairOf({ sliceIndex: 0, source: '小猫在窗台上睡到中午。[^1]', target: 'Mittens slept on the sill until noon.[^1]', },),
  pairOf({ sliceIndex: 1, source: '她的哥哥给她带来一根羽毛。', target: 'Her brother brought her a feather.', },),
  pairOf({ sliceIndex: 2, source: '白胡子数着外面的鸟。[^3]', target: 'Whiskers counted the birds outside.[^3]', },),
  pairOf({ sliceIndex: 3, source: '晚饭是鱼。[^2]', target: 'Dinner was fish.[^2]', },),
  pairOf({
    sliceIndex: 4,
    source: `${SOURCE_NOTE_ONE}\n[^2]: 鱼是妈妈买的。`,
    target: `${TARGET_NOTE_ONE}\n[^2]: Mum bought the fish.`,
  },),
];

/**
 Windows of every slice, each side's document being its slices joined, as
 preparation's is wherever every definition sits in some slice.

 @param slices - prepared pairs in document order

 @returns Window per stamped index

 @example
 ```ts
 const windows = windowsOf({ slices: SLICES, },);
 ```
 */
function windowsOf({ slices, }: { readonly slices: readonly ChunkPair[]; },): ReturnType<typeof sliceNeighbourContexts> {
  return sliceNeighbourContexts({
    slices,
    sourceText: slices.map(function sourceOf(slice,) {
      return slice.source.text;
    },)
      .join('\n\n',),
    targetText: slices.map(function targetOf(slice,) {
      return slice.target.text;
    },)
      .join('\n\n',),
  },);
}

//endregion Fixtures

await describe({
  name: 'footnotes in the fidelity window',
  children: [
    it({
      name: 'APPENDS the definition a slice cites from outside its window, continuation line included, each side from its own document',
      fn: async () => {
        /** Window of the first slice, whose note is defined four slices on. */
        const beside = windowsOf({ slices: SLICES, },)
          .get(0,);

        expect(beside?.sourceText,).toBe(`她的哥哥给她带来一根羽毛。\n\n${SOURCE_NOTE_ONE}`,);
        expect(beside?.incumbentText,).toBe(`Her brother brought her a feather.\n\n${TARGET_NOTE_ONE}`,);
      },
    },),

    it({
      name: 'REPEATS NOTHING the window already shows: the slice beside the definitions sees them once',
      fn: async () => {
        /** Window of the fourth slice, whose neighbour holds the definitions. */
        const beside = windowsOf({ slices: SLICES, },)
          .get(3,);

        expect(beside?.sourceText,).toBe(`白胡子数着外面的鸟。[^3]\n\n${SOURCE_NOTE_ONE}\n[^2]: 鱼是妈妈买的。`,);
      },
    },),

    it({
      name: 'ADDS NOTHING for a label no slice defines, nor for a slice citing nothing',
      fn: async () => {
        /** Every window. */
        const windows = windowsOf({ slices: SLICES, },);

        expect(windows.get(2,)?.sourceText,).toBe('她的哥哥给她带来一根羽毛。\n\n晚饭是鱼。[^2]',);
        expect(windows.get(1,)?.incumbentText,).toBe(
          'Mittens slept on the sill until noon.[^1]\n\nWhiskers counted the birds outside.[^3]',
        );
      },
    },),

    it({
      name: 'READS A DEFINITION LINE AS NO CITATION: the slice holding the notes gains nothing from its own labels',
      fn: async () => {
        /** Window of the last slice. */
        const beside = windowsOf({ slices: SLICES, },)
          .get(4,);

        expect(beside?.sourceText,).toBe('晚饭是鱼。[^2]',);
      },
    },),

    it({
      name: 'ENDS A DEFINITION AT A BLANK LINE unless indented text follows, reads one indented by up to three spaces, and takes the first of two definitions of a label, as GFM does',
      fn: async () => {
        /** Four slices whose last defines note a with a later paragraph, an afterword and a repeat. */
        const slices = [
          pairOf({ sliceIndex: 0, source: '猫咪打了个哈欠。[^a]', target: 'The cat yawned.[^a]', },),
          pairOf({ sliceIndex: 1, source: '猫咪伸了个懒腰。', target: 'The cat stretched.', },),
          pairOf({ sliceIndex: 2, source: '猫咪睡着了。', target: 'The cat fell asleep.', },),
          pairOf({
            sliceIndex: 3,
            source: '[^a]: 第一段。\n\n    第二段。\n\n后记。\n\n[^a]: 重复的定义。',
            target: '  [^a]: First paragraph.\n\n    Second paragraph.\n\nAfterword.',
          },),
        ];
        /** Window of the first slice. */
        const beside = windowsOf({ slices, },)
          .get(0,);

        expect(beside?.sourceText,).toBe('猫咪伸了个懒腰。\n\n[^a]: 第一段。\n\n    第二段。',);
        expect(beside?.incumbentText,).toBe(
          'The cat stretched.\n\n  [^a]: First paragraph.\n\n    Second paragraph.',
        );
      },
    },),

    it({
      name: 'READS A LINE OPENING WITH A MARKER AS A CITATION, since only a colon after the label makes a definition, and counts no other markup as a citation',
      fn: async () => {
        /** Five slices: the first opens with its marker, the second holds a tag, the last defines the note. */
        const slices = [
          pairOf({ sliceIndex: 0, source: '[^1]猫咪打了个哈欠。', target: '[^1] The cat yawned.', },),
          pairOf({ sliceIndex: 1, source: '猫咪<u1>伸了个懒腰</u1>。', target: 'The cat <u1>stretched</u1>.', },),
          pairOf({ sliceIndex: 2, source: '猫咪睡着了。', target: 'The cat fell asleep.', },),
          pairOf({ sliceIndex: 3, source: '猫咪醒了。', target: 'The cat woke up.', },),
          pairOf({ sliceIndex: 4, source: '[^1]: 注释。', target: '[^1]: A note.', },),
        ];
        /** Every window. */
        const windows = windowsOf({ slices, },);

        expect(windows.get(0,)?.sourceText,).toBe('猫咪<u1>伸了个懒腰</u1>。\n\n[^1]: 注释。',);
        expect(windows.get(1,)?.incumbentText,).toBe('[^1] The cat yawned.\n\nThe cat fell asleep.',);
      },
    },),

    it({
      name: 'READS DEFINITIONS FROM THE WHOLE DOCUMENT, since preparation keeps notes an archive translator added in no slice at all (shihai4h slices 33 and 37 cite notes 5 and 7, defined only in the archive text)',
      fn: async () => {
        /** Three slices whose middle translation cites a note no slice holds. */
        const slices = [
          pairOf({ sliceIndex: 0, source: '猫咪伸了个懒腰。', target: 'The cat stretched.', },),
          pairOf({ sliceIndex: 1, source: '猫咪打了个哈欠。', target: 'The cat yawned.[^5]', },),
          pairOf({ sliceIndex: 2, source: '猫咪睡着了。', target: 'The cat fell asleep.', },),
        ];
        /** Archive text holding the note after its last slice. */
        const targetText = 'The cat stretched.\n\nThe cat yawned.[^5]\n\nThe cat fell asleep.\n\n[^5]: Quoted from the cat diary.';
        /** Every window. */
        const windows = sliceNeighbourContexts({
          slices,
          sourceText: '猫咪伸了个懒腰。\n\n猫咪打了个哈欠。\n\n猫咪睡着了。',
          targetText,
        },);

        expect(windows.get(1,)?.incumbentText,).toBe(
          'The cat stretched.\n\nThe cat fell asleep.\n\n[^5]: Quoted from the cat diary.',
        );
        expect(windows.get(1,)?.sourceText,).toBe('猫咪伸了个懒腰。\n\n猫咪睡着了。',);
      },
    },),
  ],
},);
