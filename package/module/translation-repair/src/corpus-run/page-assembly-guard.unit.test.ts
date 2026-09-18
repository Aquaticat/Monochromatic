/**
 Tests the page-level assembly guard over a composed page.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  guardPageAssembly,
  makeInsertionChunk,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 Archive whose body refers to a note it never defines.
 */
const TARGET = 'The cat naps on the windowsill[^1].\n';

/**
 One content slice plus the anchor where the notes belong.
 */
const SLICES: readonly ChunkPair[] = [
  {
    source: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: 12,
      text: '猫猫在窗台上打盹〔1〕。',
    },
    target: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: TARGET.length,
      text: TARGET,
    },
  },
  {
    source: {
      kind: 'content',
      sliceIndex: 1,
      nodes: [],
      startOffset: 14,
      endOffset: 40,
      text: '〔1〕：那是它最喜欢的位置。\n〔2〕：一只麻雀。',
    },
    target: makeInsertionChunk({ sliceIndex: 1, offset: TARGET.length, },),
  },
];

/**
 Builds a source whose consolidation wrote the notes at the anchor.
 
 @param notes - what the consolidation wrote at slice 1
 
 @returns Narrow artifact source read by the publication assembler
 
 @example
 ```ts
 const artifact = consolidating({ notes: '[^1]: A note.', },);
 ```
 */
function consolidating({ notes, }: { readonly notes: string; },): WouldShipSource {
  return {
    comparison: [
      {
        sliceIndex: 0,
        incumbentKind: 'present',
        incumbentText: TARGET,
        repairText: TARGET,
        translateText: TARGET,
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'decided', acceptedText: TARGET, },
        translateOutcome: { kind: 'decided', acceptedText: TARGET, },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'incumbent-retained', },
        translateDelivery: { kind: 'incumbent-retained', },
      },
      {
        sliceIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: '',
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'not-evaluated', },
        translateOutcome: { kind: 'not-evaluated', },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'gap-remains', },
      },
    ],
    consolidation: {
      kind: 'settled',
      slices: [{
        sliceIndex: 1,
        terminal: 'consolidated',
        shipped: { kind: 'consolidated', text: notes, },
        rewrapped: false,
        demoted: false,
        verdicts: [],
        gate: { kind: 'not-asked', },
      },],
    },
    laneSelection: { kind: 'contested', slices: [], },
  } as unknown as WouldShipSource;
}

/**
 Archive carrying one paragraph and none of the disclosure block after it.
 */
const HALVES_TARGET = 'The cat naps on the windowsill.\n\n';

/**
 Opening half of the block the archive never carried.
 */
const OPEN_HALF_SOURCE = '<details style="margin-top: 0.5rem;">\n<summary>猫的故事</summary>';

/**
 Closing half of that block.
 */
const CLOSE_HALF_SOURCE = '猫在夜里回家了。\n\n</details>';

/**
 Rendering of the closing half.
 */
const CLOSE_HALF_TEXT = 'The cat came home at night.\n\n</details>\n';

/**
 One content slice and the two halves of the block, both anchored after it.
 */
const HALVES_SLICES: readonly ChunkPair[] = [
  {
    source: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: 9,
      text: '猫猫在窗台上打盹。',
    },
    target: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: HALVES_TARGET.length,
      text: HALVES_TARGET,
    },
  },
  {
    source: {
      kind: 'content',
      sliceIndex: 1,
      nodes: [],
      startOffset: 11,
      endOffset: 11 + OPEN_HALF_SOURCE.length,
      text: OPEN_HALF_SOURCE,
    },
    target: makeInsertionChunk({ sliceIndex: 1, offset: HALVES_TARGET.length, },),
  },
  {
    source: {
      kind: 'content',
      sliceIndex: 2,
      nodes: [],
      startOffset: 13 + OPEN_HALF_SOURCE.length,
      endOffset: 13 + OPEN_HALF_SOURCE.length + CLOSE_HALF_SOURCE.length,
      text: CLOSE_HALF_SOURCE,
    },
    target: makeInsertionChunk({ sliceIndex: 2, offset: HALVES_TARGET.length, },),
  },
];

/**
 Builds a source whose translate lane filled the closing half alone.

 @returns Narrow artifact source read by the publication assembler

 @example
 ```ts
 const artifact = closingHalfAlone();
 ```
 */
function closingHalfAlone(): WouldShipSource {
  return {
    comparison: [
      {
        sliceIndex: 0,
        incumbentKind: 'present',
        incumbentText: HALVES_TARGET,
        repairText: HALVES_TARGET,
        translateText: HALVES_TARGET,
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'decided', acceptedText: HALVES_TARGET, },
        translateOutcome: { kind: 'decided', acceptedText: HALVES_TARGET, },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'incumbent-retained', },
        translateDelivery: { kind: 'incumbent-retained', },
      },
      {
        sliceIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: '',
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'not-evaluated', },
        translateOutcome: { kind: 'not-evaluated', },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'gap-remains', },
      },
      {
        sliceIndex: 2,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: CLOSE_HALF_TEXT,
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'not-evaluated', },
        translateOutcome: { kind: 'decided', acceptedText: CLOSE_HALF_TEXT, },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'gap-remains', },
      },
    ],
    consolidation: {
      kind: 'settled',
      slices: [{
        sliceIndex: 2,
        terminal: 'consolidated',
        shipped: { kind: 'consolidated', text: CLOSE_HALF_TEXT, },
        rewrapped: false,
        demoted: false,
        verdicts: [],
        gate: { kind: 'not-asked', },
      },],
    },
    laneSelection: { kind: 'contested', slices: [], },
  } as unknown as WouldShipSource;
}

await describe({
  name: guardPageAssembly.name,
  children: [
    it({
      name: 'WITHHOLDS A CONTAINER HALF WHOSE PARTNER SHIPS NOTHING on the composed page, naming the partner '
        + '(class fifty-seven, XingZ607)',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: closingHalfAlone(),
          slices: HALVES_SLICES,
          sourceText: `猫猫在窗台上打盹。\n\n${OPEN_HALF_SOURCE}\n\n${CLOSE_HALF_SOURCE}\n`,
          targetText: HALVES_TARGET,
        },);
        expect(assembly.withdrawn,).toEqual([2,],);
        expect(assembly.trimmed,).toEqual([],);
        expect(assembly.findings,).toEqual([
          'assembly-container-half-withheld (slice 2 beside slice 1: one container\'s halves ship together, and '
          + 'slice 1 ships nothing)',
        ],);
      },
    },),
    it({
      name: 'TRIMS the orphan out of the consolidation\'s two notes one line apart and records the text the '
        + 'page carries (the twenty-second hakureico pass of 2026-09-09 shipped the consolidation\'s fresh '
        + 'rendering of both notes and the page guard refused the page)',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: consolidating({ notes: '[^1]: That is its favourite spot.\n[^2]: A sparrow.', },),
          slices: SLICES,
          sourceText: '猫猫在窗台上打盹〔1〕。\n\n〔1〕：那是它最喜欢的位置。\n〔2〕：一只麻雀。\n',
          targetText: TARGET,
        },);
        expect(assembly.withdrawn,).toEqual([],);
        expect(assembly.trimmed,).toEqual([{
          sliceIndex: 1,
          replacementText: '[^1]: That is its favourite spot.',
        },],);
        expect(assembly.findings,).toEqual([
          'assembly-footnote-trimmed orphan-definition gfm 2 (slice 1)',
        ],);
      },
    },),
    it({
      name: 'records nothing on a page whose footnote graph is whole',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: consolidating({ notes: '[^1]: That is its favourite spot.', },),
          slices: SLICES,
          sourceText: '猫猫在窗台上打盹〔1〕。\n\n〔1〕：那是它最喜欢的位置。\n〔2〕：一只麻雀。\n',
          targetText: TARGET,
        },);
        expect(assembly,).toEqual({ trimmed: [], withdrawn: [], findings: [], },);
      },
    },),
  ],
},);
