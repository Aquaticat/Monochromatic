/**
 Guards the rule that a container's halves are admitted together (XingZ607):
 once any slice inside a container is admitted on its own evidence, the
 halves the admission left out follow it, and the finding names the slice
 they follow. Driven directly here, where the pass's own test drives it
 through the whole admission. Cat-themed invention throughout; no corpus
 content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  admitContainerHalves,
  type ChunkPair,
  CONTAINER_HALF_ADMITTED_FINDING,
  type InsertionCoverageRow,
  makeInsertionChunk,
} from '../../dist/final/node/index.mjs';

/**
 Builds one source-only slice.

 @param sliceIndex - where the slice stands

 @param source - original text with no rendering beside it

 @returns Slice whose target is an insertion

 @example
 ```ts
 const slice = insertion({ sliceIndex: 0, source: '<details>', },);
 ```
 */
function insertion(
  {
    sliceIndex,
    source,
  }: {
    readonly sliceIndex: number;
    readonly source: string;
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
    target: makeInsertionChunk({
      sliceIndex,
      offset: 0,
    },),
  };
}

/**
 Opening half of the disclosure block: the tag and its summary.
 */
const OPEN_HALF = '<details>\n\n<summary>猫的故事</summary>';

/**
 Closing half: the last paragraph and the closing tag.
 */
const CLOSE_HALF = '猫不喜欢洗澡。\n\n</details>';

/**
 A disclosure block the archive never rendered: the opening half, two
 paragraphs and the closing half, each its own source-only slice.
 */
const BLOCK: readonly ChunkPair[] = [
  insertion({
    sliceIndex: 0,
    source: OPEN_HALF,
  },),
  insertion({
    sliceIndex: 1,
    source: '橘猫在窗台上睡了整个下午。',
  },),
  insertion({
    sliceIndex: 2,
    source: '猫在夜里回家了。',
  },),
  insertion({
    sliceIndex: 3,
    source: CLOSE_HALF,
  },),
];

/**
 Unresolved row for one half, which the whole-page budget refused.

 @param position - where the half stands

 @param sourceText - the half's original

 @returns Row neither admitted nor proven carried

 @example
 ```ts
 const row = halfRow({ position: 0, sourceText: '<details>', },);
 ```
 */
function halfRow(
  {
    position,
    sourceText,
  }: {
    readonly position: number;
    readonly sourceText: string;
  },
): InsertionCoverageRow {
  return {
    position,
    sliceIndex: position,
    sourceText,
    frontMatter: false,
    verdictKind: 'split',
    anchoredFull: 0,
    anchoredPartial: 1,
    absentCount: 1,
    heard: 2,
    asked: 2,
    missingDestinationCount: 0,
    coverageFinding: `insertion-coverage (slice ${String(position,)})`,
    stageFindings: [],
    coverageEvidence: [],
    destinationFindings: [],
  };
}

await describe({
  name: admitContainerHalves.name,
  children: [
    it({
      name: 'ADMITS BOTH HALVES beside the earliest admitted slice inside the container, whatever order the '
        + 'admitted positions come in',
      fn: async () => {
        const halves = admitContainerHalves({
          slices: BLOCK,
          // Listed later first, so the finding's slice comes from document order.
          positions: new Set([
            2,
            1,
          ],),
          unresolvedRows: [
            halfRow({
              position: 0,
              sourceText: OPEN_HALF,
            },),
            halfRow({
              position: 3,
              sourceText: CLOSE_HALF,
            },),
          ],
        },);
        expect([...halves.positions,].toSorted(function ascending(
          left,
          right,
        ): number {
          return left - right;
        },),).toEqual([
          0,
          1,
          2,
          3,
        ],);
        expect(halves.unresolvedRows,).toEqual([],);
        expect(halves.findings,).toEqual([
          `${CONTAINER_HALF_ADMITTED_FINDING} (slice 0 beside slice 1: one container's halves ship together, `
          + 'and slice 1 is admitted)',
          `${CONTAINER_HALF_ADMITTED_FINDING} (slice 3 beside slice 1: one container's halves ship together, `
          + 'and slice 1 is admitted)',
        ],);
      },
    },),
  ],
},);
