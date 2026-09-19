/**
 Guards class sixty-one (XingZ611, 2026-09-19): a source-only passage the
 roster found absent, standing inside a container the archive carries with
 fewer blocks than the original writes there, is admitted on that deficit.
 The whole-page budget refuses it on a page whose translated part runs long,
 and the disclosure block's third paragraph shipped as a recorded gap while
 the archive's block had one paragraph fewer than the original's. A container
 whose archive half has as many blocks as the original's admits nothing, and
 a split with an anchored claim is not an absent verdict. Cat-themed
 invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  admitContainerDeficit,
  type ChunkPair,
  type InsertionCoverageRow,
  makeInsertionChunk,
} from '../../dist/final/node/index.mjs';

/**
 Opening half of a disclosure block: the tag and its summary.
 */
const OPEN_SOURCE = '<details>\n\n<summary>猫的故事</summary>';

/**
 Archive's rendering of the opening half, the tag written its own way.
 */
const OPEN_TARGET = '<details style="margin-top: 0.5rem;">\n<summary>The cat\'s story</summary>';

/**
 First paragraph inside the block, translated.
 */
const FIRST_SOURCE = '橘猫在窗台上睡了整个下午。';

/**
 Archive's rendering of the first paragraph.
 */
const FIRST_TARGET = 'The orange cat slept on the windowsill all afternoon.';

/**
 Paragraph the archive never rendered.
 */
const MISSING_SOURCE = '猫在夜里回家了，谁也没有听见门响。';

/**
 Closing half: the last paragraph and the closing tag.
 */
const CLOSE_SOURCE = '猫不喜欢洗澡。\n\n</details>';

/**
 Archive's rendering of the closing half.
 */
const CLOSE_TARGET = 'The cat does not like baths.\n\n</details>';

/**
 Builds one paired slice.

 @param sliceIndex - where the slice stands

 @param source - original text

 @param target - archive text

 @returns Slice paired with its rendering

 @example
 ```ts
 const slice = paired({ sliceIndex: 0, source: OPEN_SOURCE, target: OPEN_TARGET, },);
 ```
 */
function paired(
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
 Builds one source-only slice.

 @param sliceIndex - where the slice stands

 @param source - original text with no rendering beside it

 @returns Slice whose target is an insertion

 @example
 ```ts
 const slice = insertion({ sliceIndex: 2, source: MISSING_SOURCE, },);
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
 Unresolved row for the missing paragraph at slice 2.

 @param verdict - what the roster said about it

 @returns Row the whole-page budget refused

 @example
 ```ts
 const row = missingRow({ verdict: 'absent', },);
 ```
 */
function missingRow(
  { verdict, }: { readonly verdict: 'absent' | 'anchored-split'; },
): InsertionCoverageRow {
  return {
    position: 2,
    sliceIndex: 2,
    sourceText: MISSING_SOURCE,
    frontMatter: false,
    verdictKind: (verdict === 'absent') ? 'absent' : 'split',
    anchoredFull: 0,
    anchoredPartial: (verdict === 'absent') ? 0 : 1,
    absentCount: (verdict === 'absent') ? 2 : 1,
    heard: 2,
    asked: 2,
    missingDestinationCount: 0,
    coverageFinding: 'insertion-coverage (slice 2)',
    stageFindings: [],
    coverageEvidence: [],
    destinationFindings: [],
  };
}

/**
 Four slices: the opening half, one paired paragraph, the missing paragraph
 and the closing half, the archive's block one paragraph short.

 @param closeTarget - archive text of the closing half

 @returns Slices in document order

 @example
 ```ts
 const slices = containerSlices({ closeTarget: CLOSE_TARGET, },);
 ```
 */
function containerSlices({ closeTarget, }: { readonly closeTarget: string; },): readonly ChunkPair[] {
  return [
    paired({
      sliceIndex: 0,
      source: OPEN_SOURCE,
      target: OPEN_TARGET,
    },),
    paired({
      sliceIndex: 1,
      source: FIRST_SOURCE,
      target: FIRST_TARGET,
    },),
    insertion({
      sliceIndex: 2,
      source: MISSING_SOURCE,
    },),
    paired({
      sliceIndex: 3,
      source: CLOSE_SOURCE,
      target: closeTarget,
    },),
  ];
}

await describe({
  name: 'a passage absent inside a container the archive carries one block short (class sixty-one, XingZ611)',
  children: [
    it({
      name: 'ADMITS the absent paragraph on the block deficit and names it',
      fn: async () => {
        const deficit = admitContainerDeficit({
          slices: containerSlices({ closeTarget: CLOSE_TARGET, },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'absent', },),],
        },);
        expect([...deficit.positions,],).toEqual([2,],);
        expect(deficit.unresolvedRows,).toEqual([],);
        expect(deficit.findings
          .some(function named(finding,): boolean {
            return finding.startsWith('insertion-container-deficit-admitted (slice 2 inside details of slices 0 to 3',);
          },),).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES the paragraph unresolved where the archive\'s block has as many blocks as the original\'s',
      fn: async () => {
        const deficit = admitContainerDeficit({
          slices: containerSlices({
            closeTarget: `The cat came home at night.\n\n${CLOSE_TARGET}`,
          },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'absent', },),],
        },);
        expect([...deficit.positions,],).toEqual([],);
        expect(deficit.unresolvedRows.length,).toBe(1,);
      },
    },),
    it({
      name: 'ADMITS a split with a minority anchored claim on the deficit and names the split (class sixty-nine, XingZ618)',
      fn: async () => {
        const deficit = admitContainerDeficit({
          slices: containerSlices({ closeTarget: CLOSE_TARGET, },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'anchored-split', },),],
        },);
        expect([...deficit.positions,],).toEqual([2,],);
        expect(deficit.unresolvedRows,).toEqual([],);
        expect(deficit.findings
          .some(function named(finding,): boolean {
            return finding.startsWith('insertion-split-in-container-deficit (slice 2, full 0, partial 1, absent 1 of 2 asked',);
          },),).toBe(true,);
        expect(deficit.findings
          .some(function named(finding,): boolean {
            return finding.startsWith('insertion-container-deficit-admitted (slice 2 inside details of slices 0 to 3',);
          },),).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES a split with a majority carried verdict out whatever the deficit',
      fn: async () => {
        const deficit = admitContainerDeficit({
          slices: containerSlices({ closeTarget: CLOSE_TARGET, },),
          positions: new Set(),
          unresolvedRows: [{
            ...missingRow({ verdict: 'anchored-split', },),
            verdictKind: 'carried',
            anchoredFull: 2,
            absentCount: 0,
          },],
        },);
        expect([...deficit.positions,],).toEqual([],);
        expect(deficit.unresolvedRows.length,).toBe(1,);
      },
    },),
  ],
},);
