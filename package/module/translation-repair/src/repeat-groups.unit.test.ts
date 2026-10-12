/**
 Tests for repeated source wording: maximal repeats of twelve or more
 non-space characters, refrain frames with a varying slot, the exclusions
 that keep markup and quoted speech out, and the mapping of each occurrence
 to the slice that holds its offsets. Fixtures are cat-themed invention only.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  chunkByHeadings,
  parseDocument,
  repeatGroupsOf,
} from '../dist/final/node/index.mjs';

/**
 Twelve non-space characters, the shortest maximal repeat the rule reports.
 */
const RUN_TWELVE = '猫咪在窗台上晒太阳打盹儿';

/**
 Eleven non-space characters, one short of the rule.
 */
const RUN_ELEVEN = '猫咪在窗台上晒太阳打盹';

/**
 Fifteen non-space characters, so the repeat has to extend past twelve.
 */
const RUN_FIFTEEN = `${RUN_TWELVE}呀真好`;

/**
 Sentence whose refrain clauses differ only in the middle, the slot.
 */
const REFRAIN_FIRST = '所以这只猫是个胖猫咪吧';

/**
 Same frame as {@link REFRAIN_FIRST} with a one-character slot changed.
 */
const REFRAIN_SECOND = '所以这只猫是个瘦猫咪吧';

/**
 Cuts a page into the slices the pass reads, by its headings.

 @param text - page text

 @returns Chunks of the page, in order

 @example
 ```ts
 const slices = chunksOf({ text, },);
 ```
 */
function chunksOf({ text, }: { readonly text: string; },) {
  return chunkByHeadings({
    document: parseDocument({ text, },),
  },);
}

/**
 Builds one slice by hand, for a cut that a heading never makes.

 @param sliceIndex - position of the slice

 @param text - whole page text

 @param startOffset - first offset of the slice

 @param endOffset - exclusive end offset of the slice

 @returns Slice covering that span of the page

 @example
 ```ts
 const slice = sliceAt({ sliceIndex: 0, text, startOffset: 0, endOffset: 12, },);
 ```
 */
function sliceAt(
  {
    sliceIndex,
    text,
    startOffset,
    endOffset,
  }: {
    readonly sliceIndex: number;
    readonly text: string;
    readonly startOffset: number;
    readonly endOffset: number;
  },
) {
  return {
    sliceIndex,
    nodes: [],
    startOffset,
    endOffset,
    text: text.slice(startOffset, endOffset,),
  };
}

/**
 Builds the occurrence a maximal repeat reports for a span of the page.

 @param startOffset - first offset of the occurrence
 @param width - UTF-16 units the occurrence spans
 @param line - one-based line the occurrence starts on
 @param sliceIndex - index of the slice holding the occurrence

 @returns Occurrence as `repeatGroupsOf` reports it

 @example
 ```ts
 const occurrence = occurrenceAt({ startOffset: 0, width: 12, line: 1, sliceIndex: 0, },);
 ```
 */
function occurrenceAt(
  {
    startOffset,
    width,
    line,
    sliceIndex,
  }: {
    readonly startOffset: number;
    readonly width: number;
    readonly line: number;
    readonly sliceIndex: number;
  },
) {
  return {
    sliceIndex,
    startOffset,
    endOffset: startOffset + width,
    line,
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: repeatGroupsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'Finds a twelve-character repeat in two paragraphs and reports both places',
          fn: async () => {
            /** Page with the same twelve characters in two paragraphs. */
            const text = `${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves an eleven-character repeat unreported',
          fn: async () => {
            /** Page with the same eleven characters in two paragraphs. */
            const text = `${RUN_ELEVEN}。\n\n午后，${RUN_ELEVEN}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Extends a repeat to its full length while every occurrence agrees',
          fn: async () => {
            /** Page with a fifteen-character repeat in two paragraphs. */
            const text = `${RUN_FIFTEEN}。\n\n午后，${RUN_FIFTEEN}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_FIFTEEN,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_FIFTEEN, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 15,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 15,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 15,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reports a twelve-character repeat of three occurrences, and the longer repeat its last two share',
          fn: async () => {
            /**
             Page with the same twelve characters in three paragraphs. The last two stand between the same commas,
             so the sub-run from the comma before them to the comma after them is a second maximal repeat.
             */
            const text = `${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n\n傍晚，${RUN_TWELVE}，又伸了个懒腰。\n`;
            /** Offsets of the three occurrences, in page order. */
            const starts = [
              text.indexOf(RUN_TWELVE,),
              text.indexOf(RUN_TWELVE, text.indexOf(RUN_TWELVE,) + 1,),
            ] as const;
            /** Offset of the third occurrence. */
            const third = text.indexOf(RUN_TWELVE, starts[1] + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: starts[0],
                    endOffset: starts[0] + 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: starts[1],
                    endOffset: starts[1] + 12,
                    line: 3,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: third,
                    endOffset: third + 12,
                    line: 5,
                  },
                ],
                unplaced: [],
              },
              {
                kind: 'maximal',
                length: 14,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: starts[1] - 1,
                    endOffset: starts[1] + 13,
                    line: 3,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: third - 1,
                    endOffset: third + 13,
                    line: 5,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a repeat whose occurrences all sit on one line out of the groups',
          fn: async () => {
            /** Page with the same twelve characters twice on one line. */
            const text = `${RUN_TWELVE}，${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves a repeat with an occurrence inside quotation marks out of the groups',
          fn: async () => {
            /** Page whose first occurrence sits inside an open quotation. */
            const text = `「${RUN_TWELVE}。」\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves front matter out of the repeat groups',
          fn: async () => {
            /** Front matter echoing the one body paragraph, which stands once. */
            const text = `---\ndescription: ${RUN_TWELVE}。\n---\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves headings out of the repeat groups',
          fn: async () => {
            /** Heading repeating the one body paragraph, which stands once. */
            const text = `## ${RUN_TWELVE}\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves blockquotes out of the repeat groups',
          fn: async () => {
            /** Blockquote repeating the one body paragraph, which stands once. */
            const text = `> ${RUN_TWELVE}。\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves footnote definitions out of the repeat groups',
          fn: async () => {
            /** Footnote definition repeating the body sentence, which stands once. */
            const text = `${RUN_TWELVE}。[^1]\n\n[^1]: ${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves HTML blocks and paragraphs with inline tags out of the repeat groups',
          fn: async () => {
            /** HTML block and inline-tagged paragraph around one plain body paragraph. */
            const text = `<div>${RUN_TWELVE}。</div>\n\n猫咪在窗台上<b>晒太阳打盹儿。</b>\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves URLs out of the repeat groups',
          fn: async () => {
            /** Page whose only repeat is a bare URL. */
            const text = '猫咪的主页是 https://cat.example.invalid/whiskers/page 请看。\n\n'
              + '猫咪的主页是 https://cat.example.invalid/whiskers/page 请看。\n';

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves code out of the repeat groups',
          fn: async () => {
            /** Fenced code and inline code around one plain body paragraph. */
            const text = `\`\`\`\n${RUN_TWELVE}。\n\`\`\`\n\n${RUN_TWELVE}。\n\n\`${RUN_TWELVE}。\`\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves list items out of the repeat groups',
          fn: async () => {
            /** List item repeating the one body paragraph, which stands once. */
            const text = `- ${RUN_TWELVE}。\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Finds a refrain whose varying slot differs between two clauses',
          fn: async () => {
            /** Two clauses that share a prefix and a suffix around a one-character slot. */
            const text = `${REFRAIN_FIRST}。\n\n${REFRAIN_SECOND}。\n`;
            /** Offset of the first clause. */
            const first = text.indexOf(REFRAIN_FIRST,);
            /** Offset of the second clause. */
            const second = text.indexOf(REFRAIN_SECOND,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以这只猫是个',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 11,
                    line: 1,
                    slotStartOffset: first + 7,
                    slotEndOffset: first + 8,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 11,
                    line: 3,
                    slotStartOffset: second + 7,
                    slotEndOffset: second + 8,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reports identical clauses as a maximal repeat and no refrain',
          fn: async () => {
            /** Two identical clauses, which share no slot and so form no refrain frame. */
            const text = `${REFRAIN_FIRST}。\n\n${REFRAIN_FIRST}。\n`;
            /** Offset of the first clause. */
            const first = text.indexOf(REFRAIN_FIRST,);
            /** Offset of the second clause. */
            const second = text.indexOf(REFRAIN_FIRST, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a refrain whose varying slot is longer than eight characters out of the groups',
          fn: async () => {
            /** Clause whose slot holds nine characters, one more than the rule allows. */
            const text = `所以这只猫是个胖胖胖胖胖胖胖胖胖猫咪吧。\n\n${REFRAIN_SECOND}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves a refrain whose shared prefix is shorter than four characters out of the groups',
          fn: async () => {
            /** Clauses that share only three leading characters. */
            const text = '小猫很胖猫咪吧。\n\n小猫很瘦猫咪吧。\n';

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Finds a refrain of three clauses as one group',
          fn: async () => {
            /** Three clauses sharing one frame, each with a different one-character slot. */
            const text = `${REFRAIN_FIRST}。\n\n${REFRAIN_SECOND}。\n\n所以这只猫是个软猫咪吧。\n`;
            /** Offset of the third clause. */
            const third = text.indexOf('所以这只猫是个软',);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以这只猫是个',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 11,
                    line: 1,
                    slotStartOffset: 7,
                    slotEndOffset: 8,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: 14,
                    endOffset: 25,
                    line: 3,
                    slotStartOffset: 21,
                    slotEndOffset: 22,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: third,
                    endOffset: third + 11,
                    line: 5,
                    slotStartOffset: third + 7,
                    slotEndOffset: third + 8,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a refrain whose occurrences all sit on one line out of the groups',
          fn: async () => {
            /** Both clauses of the frame on one line, which is parallel phrasing. */
            const text = `${REFRAIN_FIRST}，${REFRAIN_SECOND}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves a refrain with a quoted clause out of the groups',
          fn: async () => {
            /** Frame whose first clause is quoted speech. */
            const text = `「${REFRAIN_FIRST}。」\n\n${REFRAIN_SECOND}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Maps each occurrence to the slice that holds its offsets',
          fn: async () => {
            /** Page whose two headed sections each carry one occurrence. */
            const text = `## 晒太阳\n\n${RUN_TWELVE}。\n\n## 午后\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 12,
                    line: 3,
                  },
                  {
                    sliceIndex: 1,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 7,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Maps occurrences on either side of a slice boundary that splits one paragraph',
          fn: async () => {
            /** One paragraph whose two occurrences lie either side of a cut between its lines. */
            const text = `${RUN_TWELVE}，\n尾巴一卷一卷。\n${RUN_TWELVE}。\n`;
            /** Cut placed at the start of the middle line. */
            const cut = text.indexOf('尾巴',);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Slices on either side of that cut. */
            const slices = [
              sliceAt({
                sliceIndex: 0,
                text,
                startOffset: 0,
                endOffset: cut,
              },),
              sliceAt({
                sliceIndex: 1,
                text,
                startOffset: cut,
                endOffset: text.length,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 1,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reports an occurrence that a slice boundary cuts in half as unplaced, with its group otherwise whole',
          fn: async () => {
            /** Page whose second occurrence is cut in half by a slice boundary. */
            const text = `${RUN_TWELVE}，\n尾巴一卷一卷。\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Cut five characters into the second occurrence. */
            const cut = second + 5;
            /** Slices that split the second occurrence. */
            const slices = [
              sliceAt({
                sliceIndex: 0,
                text,
                startOffset: 0,
                endOffset: cut,
              },),
              sliceAt({
                sliceIndex: 1,
                text,
                startOffset: cut,
                endOffset: text.length,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                  },
                ],
                unplaced: [
                  {
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                    reason: 'crosses-slice-end',
                  },
                ],
              },
            ],);
          },
        },),

        it({
          name: 'Reports an occurrence that lies in no slice as unplaced, as a sealed or refused section leaves it',
          fn: async () => {
            /** Page whose second occurrence sits past the only slice. */
            const text = `${RUN_TWELVE}，\n尾巴一卷一卷。\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Slice that stops where the second occurrence starts. */
            const slices = [
              sliceAt({
                sliceIndex: 0,
                text,
                startOffset: 0,
                endOffset: second,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                  },
                ],
                unplaced: [
                  {
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                    reason: 'in-no-slice',
                  },
                ],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a repeat out of the groups when an occurrence begins at the opening quotation mark',
          fn: async () => {
            /** Page repeating one quoted line, so the repeat extends left to the opening mark. */
            const text = `「${RUN_TWELVE}」\n\n午后，「${RUN_TWELVE}」\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads quoted speech as quoted after a closing mark that no opening mark matches',
          fn: async () => {
            /** Page whose first paragraph closes a quotation it never opened, then quotes the repeat. */
            const text = `她说」好。「${RUN_TWELVE}。」\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves the text of an HTML comment inside a paragraph out of the repeat groups',
          fn: async () => {
            /** Page whose second paragraph hides the repeat in a comment. */
            const text = `${RUN_TWELVE}。\n\n午后，<!-- ${RUN_TWELVE} -->尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves paragraphs with an expression out of the repeat groups',
          fn: async () => {
            /** Page whose second paragraph carries a brace expression around the repeat. */
            const text = `${RUN_TWELVE}。\n\n午后，{窗台} ${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves import and export lines out of the repeat groups',
          fn: async () => {
            /** Page whose export line holds the one body paragraph's wording. */
            const text = `export const mood = '${RUN_TWELVE}';\n\n${RUN_TWELVE}。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves link destinations out of the repeat groups',
          fn: async () => {
            /** Page whose only repeat is a relative link destination. */
            const text = '看[猫咪](./whiskers/nap-time-page)吧。\n\n再看[猫咪](./whiskers/nap-time-page)吧。\n';

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves footnote references out of the repeat groups',
          fn: async () => {
            /** Page whose two paragraphs share only a footnote reference. */
            const text = '甲[^cat-note-one]乙。\n\n丙[^cat-note-one]丁。\n\n[^cat-note-one]: 猫咪的注。\n';

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Counts a character outside the basic plane as one character of a repeat and spans both of its code units',
          fn: async () => {
            /** Eleven plain characters and one outside the basic plane, which make twelve characters. */
            const run = '猫咪在窗台上晒太阳打盹😀';
            /** Page repeating that run in two paragraphs. */
            const text = `${run}。\n\n午后，${run}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(run, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 13,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 13,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps a refrain frame whole when two slots differ only in the second code unit of a character',
          fn: async () => {
            /** Two clauses whose slots are different characters that share their first code unit. */
            const text = '所以这只猫是个😀猫咪吧。\n\n所以这只猫是个😁猫咪吧。\n';
            /** Offset of the second clause. */
            const second = text.indexOf('所以这只猫是个😁',);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以这只猫是个',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                    slotStartOffset: 7,
                    slotEndOffset: 9,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                    slotStartOffset: second + 7,
                    slotEndOffset: second + 9,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps the occurrences of a repeat from overlapping one another',
          fn: async () => {
            /** Page repeating a single character thirteen times in two paragraphs, so every shift of twelve matches. */
            const text = `${'猫'.repeat(13,)}\n\n${'猫'.repeat(13,)}\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: 15,
                    endOffset: 27,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps an opening backtick with no closing one on its line or paragraph as wording',
          fn: async () => {
            /** Page whose first paragraph breaks its line after the backtick and holds another on the next line, and whose second ends after it. */
            const text = `${RUN_TWELVE}\`\n尾巴\`一卷一卷。\n\n午后，${RUN_TWELVE}\`，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 13,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 13,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 13,
                    line: 4,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps a footnote reference opening with no closing bracket as wording',
          fn: async () => {
            /** Page whose two paragraphs end in a reference opening that never closes. */
            const text = `${RUN_TWELVE}[^注。\n\n午后，${RUN_TWELVE}[^注，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 15,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 15,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 15,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps a link destination opening with no closing parenthesis as wording',
          fn: async () => {
            /** Page whose two paragraphs end in a destination opening that never closes. */
            const text = `${RUN_TWELVE}](相册。\n\n午后，${RUN_TWELVE}](相册，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 16,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 16,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 16,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps a URL scheme with nothing after it as wording',
          fn: async () => {
            /** Page whose two paragraphs share the repeat and a bare scheme after a space. */
            const text = `${RUN_TWELVE} https:// 好。\n\n午后，${RUN_TWELVE} https:// 吧，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 20,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 21,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 21,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a refrain whose shared suffix is shorter than three characters out of the groups',
          fn: async () => {
            /** Clauses that share seven leading characters and no trailing one. */
            const text = '所以这只猫是个胖猫咪吧。\n\n所以这只猫是个瘦猫咪呀。\n';

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads the wording of a page the MDX grammar refused and the parse read as plain Markdown',
          fn: async () => {
            /** Page whose second paragraph holds a less-than sign before a digit, which strict MDX refuses. */
            const text = `${RUN_TWELVE}。\n\n午后，温度<5度，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 12,
                    line: 1,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 12,
                    line: 3,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Finds the four refrain lines and a sentence repeated inside longer sentences on one page',
          fn: async () => {
            /** Four refrain lines, then one sentence that stands inside two longer sentences. */
            const text = `${[
              '咪咪说：所以它是只胖乎乎的小猫吧。',
              '阿黄说：所以它是只黑色的小猫吧。',
              '花花说：所以它是只三花的小猫吧。',
              '雪球说：所以它是只白白的小猫吧。',
              '午后，窗台上的阳光暖洋洋地洒下来，猫咪们都醒了。',
              '它眯着眼睛说：窗台上的阳光暖洋洋地洒下来。',
            ].join('\n\n',)}\n`;
            /** Offsets of the four refrain clauses. */
            const refrainStarts = [
              text.indexOf('所以它是只胖',),
              text.indexOf('所以它是只黑',),
              text.indexOf('所以它是只三',),
              text.indexOf('所以它是只白',),
            ] as const;
            /** Offset of the sentence's first occurrence. */
            const first = text.indexOf('窗台上的阳光暖洋洋地洒下来',);
            /** Offset of the sentence's second occurrence. */
            const second = text.indexOf('窗台上的阳光暖洋洋地洒下来', first + 1,);
            /** Slot of the first clause, `胖乎乎`, and its clause length. */
            const firstLength = 12;
            /** Length of each of the other three clauses. */
            const otherLength = 11;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以它是只',
                suffix: '的小猫吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: refrainStarts[0],
                    endOffset: refrainStarts[0] + firstLength,
                    line: 1,
                    slotStartOffset: refrainStarts[0] + 5,
                    slotEndOffset: refrainStarts[0] + (firstLength - 4),
                  },
                  {
                    sliceIndex: 0,
                    startOffset: refrainStarts[1],
                    endOffset: refrainStarts[1] + otherLength,
                    line: 3,
                    slotStartOffset: refrainStarts[1] + 5,
                    slotEndOffset: refrainStarts[1] + (otherLength - 4),
                  },
                  {
                    sliceIndex: 0,
                    startOffset: refrainStarts[2],
                    endOffset: refrainStarts[2] + otherLength,
                    line: 5,
                    slotStartOffset: refrainStarts[2] + 5,
                    slotEndOffset: refrainStarts[2] + (otherLength - 4),
                  },
                  {
                    sliceIndex: 0,
                    startOffset: refrainStarts[3],
                    endOffset: refrainStarts[3] + otherLength,
                    line: 7,
                    slotStartOffset: refrainStarts[3] + 5,
                    slotEndOffset: refrainStarts[3] + (otherLength - 4),
                  },
                ],
                unplaced: [],
              },
              {
                kind: 'maximal',
                length: 13,
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: first,
                    endOffset: first + 13,
                    line: 9,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 13,
                    line: 11,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a paragraph whose HTML comment holds an expression brace as wording around the comment',
          fn: async () => {
            /** Page whose first paragraph ends in a comment holding a brace, which is no expression of the paragraph. */
            const text = `${RUN_TWELVE}。<!-- {窗台} -->\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a paragraph whose HTML comment holds a tag as wording around the comment',
          fn: async () => {
            /** Page whose first paragraph ends in a comment holding a tag, which is no tag of the paragraph. */
            const text = `${RUN_TWELVE}。<!-- <b>窗台</b> -->\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a paragraph whose inline code holds an expression brace as wording around the code',
          fn: async () => {
            /** Page whose first paragraph holds inline code with a brace, which is no expression of the paragraph. */
            const text = `午后，\`{窗台}\`${RUN_TWELVE}。\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a paragraph whose inline code holds a tag as wording around the code',
          fn: async () => {
            /** Page whose first paragraph holds inline code with a tag, which is no tag of the paragraph. */
            const text = `午后，\`<b>窗台</b>\`${RUN_TWELVE}。\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a paragraph whose bare URL holds an expression brace as wording around the URL',
          fn: async () => {
            /** Page whose first paragraph holds a bare URL with a brace, which is no expression of the paragraph. */
            const text = `午后，https://cat.example.invalid/{whiskers} ${RUN_TWELVE}。\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps the wording after an HTML comment that holds a URL with no space before its closing marker',
          fn: async () => {
            /** Page whose first paragraph puts the repeat right after a comment ending in a URL. */
            const text = `午后，<!--https://cat.example.invalid/whiskers-->${RUN_TWELVE}。\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Keeps the wording after an HTML comment that holds a backtick when another backtick follows',
          fn: async () => {
            /** Page whose first paragraph puts the repeat between a backtick inside a comment and a backtick outside it. */
            const text = `午后，<!--\`-->${RUN_TWELVE}\`，尾巴一卷一卷。\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a repeat across an HTML comment that stands inside it, the comment lying within its span',
          fn: async () => {
            /** Page whose first paragraph carries a comment in the middle of the repeat. */
            const text = `猫咪在窗台<!-- 注 -->上晒太阳打盹儿。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence, the only whole copy in the raw text. */
            const second = text.indexOf(RUN_TWELVE,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: text.indexOf('。',),
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a repeat in a paragraph that carries the tags of the container around it',
          fn: async () => {
            /** Page whose only paragraph of a disclosure container is widened over the container's two tags. */
            const text = `<details>\n\n${RUN_TWELVE}。\n\n</details>\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 7,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a repeat out of the groups when an occurrence sits inside straight double quotation marks',
          fn: async () => {
            /** Page whose first occurrence stands between straight double quotation marks. */
            const text = `"${RUN_TWELVE}。"\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads wording after a pair of straight double quotation marks as unquoted',
          fn: async () => {
            /** Page whose first paragraph quotes one word with straight marks, then states the repeat. */
            const text = `她说"好"。${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a repeat out of the groups when it stands inside a quotation after an inner quotation closed',
          fn: async () => {
            /** Page whose first paragraph closes an inner quotation and states the repeat inside the outer one. */
            const text = `「外面『内』${RUN_TWELVE}。」\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Leaves a repeat out of the groups when it stands inside the inner of two nested quotations',
          fn: async () => {
            /** Page whose first paragraph states the repeat inside an inner quotation of an outer one. */
            const text = `「外面『${RUN_TWELVE}』。」\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads wording after a closing mark that opens its paragraph as unquoted',
          fn: async () => {
            /** Page whose first paragraph opens with a closing mark whose quotation began in the paragraph before. */
            const text = `」${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Ends an opening mark that never closes with its paragraph, so later paragraphs read as unquoted',
          fn: async () => {
            /** Page whose first paragraph opens a quotation it never closes, before two plain paragraphs holding the repeat. */
            const text = `「他说得很轻。\n\n${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 5,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Leaves a repeat out of the groups when its paragraph reopens a quotation the paragraph before left open',
          fn: async () => {
            /** Page whose second paragraph opens again the quotation its predecessor never closed. */
            const text = `「他说得很轻。\n\n「${RUN_TWELVE}。」\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads a repeat on a page whose lines end in a carriage return and a line feed',
          fn: async () => {
            /** Page with Windows line endings, whose repeat stands on its first and third lines. */
            const text = `${RUN_TWELVE}。\r\n\r\n午后，${RUN_TWELVE}，尾巴一卷一卷。\r\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Returns no group for a page that holds front matter alone',
          fn: async () => {
            /** Page of a front matter block and nothing after it. */
            const text = `---\ntitle: ${RUN_TWELVE}\ndescription: ${RUN_TWELVE}\n---\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Returns no group for an empty page',
          fn: async () => {
            expect(repeatGroupsOf({ text: '', slices: chunksOf({ text: '', },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Returns no group for a page whose body holds no paragraph',
          fn: async () => {
            /** Page of a heading, a blockquote and a list, each repeating the same wording. */
            const text = `## ${RUN_TWELVE}\n\n> ${RUN_TWELVE}\n\n- ${RUN_TWELVE}\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([],);
          },
        },),

        it({
          name: 'Reads a repeat in a paragraph that opens with an HTML comment',
          fn: async () => {
            /** Page whose first paragraph begins with a comment. */
            const text = `<!-- 注 -->${RUN_TWELVE}。\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the first occurrence. */
            const first = text.indexOf(RUN_TWELVE,);
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, first + 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: first,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads a repeat in a paragraph that ends with an HTML comment',
          fn: async () => {
            /** Page whose first paragraph ends with a comment. */
            const text = `${RUN_TWELVE}。<!-- 注 -->\n\n午后，${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reads the paragraphs either side of an HTML comment that spans a blank line as two paragraphs',
          fn: async () => {
            /** Page whose comment holds a blank line, with the repeat before it and wording after it. */
            const text = `${RUN_TWELVE}<!-- 注\n\n注 -->猫狗乙\n\n${RUN_TWELVE}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 5,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Spans a character beyond the first plane at the start and the end of a repeat',
          fn: async () => {
            /** Ten plain characters between two ideographs from the second plane, twelve characters in all. */
            const run = '𠀀猫咪在窗台上晒太阳打𠀁';
            /** Page repeating that run in two paragraphs. */
            const text = `${run}。\n\n午后，${run}，尾巴一卷一卷。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(run, 1,);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 14,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 14,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Spans a character beyond the first plane that ends the shared prefix of a refrain',
          fn: async () => {
            /** Clauses whose shared prefix ends in an ideograph from the second plane, ahead of the slot. */
            const text = '所以这只猫是个𠀀胖猫咪吧。\n\n所以这只猫是个𠀀瘦猫咪吧。\n';
            /** Offset of the second clause. */
            const second = text.indexOf('所以这只猫是个𠀀瘦',);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以这只猫是个𠀀',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 13,
                    line: 1,
                    slotStartOffset: 9,
                    slotEndOffset: 10,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 13,
                    line: 3,
                    slotStartOffset: second + 9,
                    slotEndOffset: second + 10,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Spans a character beyond the first plane that ends the slot of a refrain',
          fn: async () => {
            /** Clauses whose slots end in different ideographs from the second plane, ahead of the shared suffix. */
            const text = '所以这只猫是个胖𠀀猫咪吧。\n\n所以这只猫是个瘦𠀁猫咪吧。\n';
            /** Offset of the second clause. */
            const second = text.indexOf('所以这只猫是个瘦',);

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'refrain',
                prefix: '所以这只猫是个',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 13,
                    line: 1,
                    slotStartOffset: 7,
                    slotEndOffset: 10,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 13,
                    line: 3,
                    slotStartOffset: second + 7,
                    slotEndOffset: second + 10,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Reports a paragraph copied whole as one repeat of its whole length',
          fn: async () => {
            /** Sixty distinct ideographs, which no shorter repeat divides. */
            const paragraph = Array.from({ length: 60, }, (_, index,) => String.fromCodePoint(0x4E_00 + (index * 37),),)
              .join('',);
            /** Page holding that paragraph twice. */
            const text = `${paragraph}\n\n${paragraph}\n`;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 60,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 60,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: 62,
                    width: 60,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Lists the shorter of two repeats that start at the same offset first',
          fn: async () => {
            /** Three paragraphs: the first two share fifteen characters, all three share their first twelve. */
            const text = `${RUN_FIFTEEN}。\n\n${RUN_FIFTEEN}，尾巴一卷一卷。\n\n${RUN_TWELVE}，又伸了个懒腰。\n`;
            /** Offsets of the three paragraphs' repeats. */
            const starts = [
              0,
              text.indexOf(RUN_FIFTEEN, 1,),
              text.indexOf(RUN_TWELVE, text.indexOf(RUN_FIFTEEN, 1,) + 1,),
            ] as const;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: starts[0],
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: starts[1],
                    width: 12,
                    line: 3,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: starts[2],
                    width: 12,
                    line: 5,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
              {
                kind: 'maximal',
                length: 15,
                occurrences: [
                  occurrenceAt({
                    startOffset: starts[0],
                    width: 15,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: starts[1],
                    width: 15,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Lists a maximal repeat before a refrain that starts at the same offset',
          fn: async () => {
            /** Two lines, each holding both clauses of one frame, so the whole line repeats and its clauses form a refrain. */
            const line = `${REFRAIN_FIRST}，${REFRAIN_SECOND}`;
            /** Page repeating that line in two paragraphs. */
            const text = `${line}\n\n${line}\n`;
            /** Offset of the second line. */
            const second = text.indexOf(line, 1,);
            /** Width of one line in UTF-16 units. */
            const width = line.length;

            expect(repeatGroupsOf({ text, slices: chunksOf({ text, },), },),).toEqual([
              {
                kind: 'maximal',
                length: 23,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width,
                    line: 3,
                    sliceIndex: 0,
                  },),
                ],
                unplaced: [],
              },
              {
                kind: 'refrain',
                prefix: '所以这只猫是个',
                suffix: '猫咪吧',
                slotBounds: {
                  minimum: 1,
                  maximum: 8,
                },
                occurrences: [
                  {
                    sliceIndex: 0,
                    startOffset: 0,
                    endOffset: 11,
                    line: 1,
                    slotStartOffset: 7,
                    slotEndOffset: 8,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: 12,
                    endOffset: 23,
                    line: 1,
                    slotStartOffset: 19,
                    slotEndOffset: 20,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second,
                    endOffset: second + 11,
                    line: 3,
                    slotStartOffset: second + 7,
                    slotEndOffset: second + 8,
                  },
                  {
                    sliceIndex: 0,
                    startOffset: second + 12,
                    endOffset: second + 23,
                    line: 3,
                    slotStartOffset: second + 19,
                    slotEndOffset: second + 20,
                  },
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Places an occurrence in the slice it is given by, whatever order the slices come in',
          fn: async () => {
            /** Page with the repeat in two paragraphs, cut between them. */
            const text = `${RUN_TWELVE}，\n\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Cut placed at the start of the second paragraph. */
            const cut = second;
            /** Slices handed over last first. */
            const slices = [
              sliceAt({
                sliceIndex: 1,
                text,
                startOffset: cut,
                endOffset: text.length,
              },),
              sliceAt({
                sliceIndex: 0,
                text,
                startOffset: 0,
                endOffset: cut,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 1,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Names a slice by its sliceIndex field and not by its position in the given list',
          fn: async () => {
            /** Page with the repeat in two paragraphs, cut between them. */
            const text = `${RUN_TWELVE}，\n\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Slices whose indexes are not their positions. */
            const slices = [
              sliceAt({
                sliceIndex: 5,
                text,
                startOffset: 0,
                endOffset: second,
              },),
              sliceAt({
                sliceIndex: 2,
                text,
                startOffset: second,
                endOffset: text.length,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 5,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 2,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Places an occurrence that a later overlapping slice holds whole, though an earlier one ends inside it',
          fn: async () => {
            /** Page with the repeat on its first and third lines. */
            const text = `${RUN_TWELVE}，\n尾巴一卷一卷。\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Slices that overlap: the first ends five characters into the second occurrence, the second starts before it. */
            const slices = [
              sliceAt({
                sliceIndex: 0,
                text,
                startOffset: 0,
                endOffset: second + 5,
              },),
              sliceAt({
                sliceIndex: 1,
                text,
                startOffset: second - 3,
                endOffset: text.length,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 0,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 1,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),

        it({
          name: 'Places an occurrence that two overlapping slices hold whole in the one with the lower sliceIndex',
          fn: async () => {
            /** Page with the repeat in two paragraphs. */
            const text = `${RUN_TWELVE}，\n\n${RUN_TWELVE}。\n`;
            /** Offset of the second occurrence. */
            const second = text.indexOf(RUN_TWELVE, 1,);
            /** Two slices that each hold the whole page, the higher index first. */
            const slices = [
              sliceAt({
                sliceIndex: 4,
                text,
                startOffset: 0,
                endOffset: text.length,
              },),
              sliceAt({
                sliceIndex: 1,
                text,
                startOffset: 0,
                endOffset: text.length,
              },),
            ];

            expect(repeatGroupsOf({ text, slices, },),).toEqual([
              {
                kind: 'maximal',
                length: 12,
                occurrences: [
                  occurrenceAt({
                    startOffset: 0,
                    width: 12,
                    line: 1,
                    sliceIndex: 1,
                  },),
                  occurrenceAt({
                    startOffset: second,
                    width: 12,
                    line: 3,
                    sliceIndex: 1,
                  },),
                ],
                unplaced: [],
              },
            ],);
          },
        },),
      ],
    },),
  ],
},);
