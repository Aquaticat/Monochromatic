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
 Archive's closing half rendering the paragraph the original's slice 2 writes,
 so the archive's block has as many blocks as the original's.
 */
const WHOLE_CLOSE_TARGET = `The cat came home at night.\n\n${CLOSE_TARGET}`;

/**
 Four slices: the opening half, one paired paragraph, the missing paragraph
 and the closing half, the archive's block one paragraph short unless a half
 says otherwise.

 @param openSource - original text of the opening half

 @param openTarget - archive text of the opening half

 @param closeSource - original text of the closing half

 @param closeTarget - archive text of the closing half

 @returns Slices in document order

 @example
 ```ts
 const slices = containerSlices({ closeTarget: CLOSE_TARGET, },);
 ```
 */
function containerSlices(
  {
    openSource = OPEN_SOURCE,
    openTarget = OPEN_TARGET,
    closeSource = CLOSE_SOURCE,
    closeTarget = CLOSE_TARGET,
  }: {
    readonly openSource?: string;
    readonly openTarget?: string;
    readonly closeSource?: string;
    readonly closeTarget?: string;
  },
): readonly ChunkPair[] {
  return [
    paired({
      sliceIndex: 0,
      source: openSource,
      target: openTarget,
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
      source: closeSource,
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
          slices: containerSlices({ closeTarget: WHOLE_CLOSE_TARGET, },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'absent', },),],
        },);
        expect([...deficit.positions,],).toEqual([],);
        expect(deficit.unresolvedRows.length,).toBe(1,);
      },
    },),
    it({
      name: 'COUNTS NOTHING AFTER THE CONTAINER\'S OWN CLOSING TAG, where the closing half goes on to a whole '
        + 'element of the same name whose archive copy is a paragraph short, and still admits where the '
        + 'container itself is short (ledger B67)',
      fn: async () => {
        /**
         Original's closing half going on to a whole element of two paragraphs.
         */
        const closeSource = `${CLOSE_SOURCE}\n\n<details>\n<summary>另一个故事</summary>\n\n第一段。\n\n第二段。\n\n</details>`;

        /**
         The archive's copy of that element, one paragraph short.
         */
        const shortElement = '\n\n<details>\n<summary>Another story</summary>\n\nThe first paragraph.\n\n</details>';
        const whole = admitContainerDeficit({
          slices: containerSlices({
            closeSource,
            closeTarget: `${WHOLE_CLOSE_TARGET}${shortElement}`,
          },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'absent', },),],
        },);
        expect([...whole.positions,],).toEqual([],);
        expect(whole.unresolvedRows.length,).toBe(1,);
        const short = admitContainerDeficit({
          slices: containerSlices({
            closeSource,
            closeTarget: `${CLOSE_TARGET}${shortElement}`,
          },),
          positions: new Set(),
          unresolvedRows: [missingRow({ verdict: 'absent', },),],
        },);
        expect([...short.positions,],).toEqual([2,],);
      },
    },),
    it({
      name: 'COUNTS NOTHING BEFORE THE CONTAINER\'S OWN OPENING TAG, where the opening half starts with a whole '
        + 'element of the same name whose archive copy is a paragraph short (ledger B67)',
      fn: async () => {
        const deficit = admitContainerDeficit({
          slices: containerSlices({
            openSource: `<details>\n<summary>前言</summary>\n\n一段。\n\n二段。\n\n</details>\n\n${OPEN_SOURCE}`,
            openTarget: '<details>\n<summary>Preface</summary>\n\nOne paragraph.\n\n</details>\n\n'
              + '<details>\n<summary>The cat\'s story</summary>',
            closeTarget: WHOLE_CLOSE_TARGET,
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
