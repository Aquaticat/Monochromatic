/**
 * Tests the page-level assembly guard over a composed page.
 *
 * @module
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
 * Archive whose body refers to a note it never defines.
 */
const TARGET = 'The cat naps on the windowsill[^1].\n';

/**
 * One content slice plus the anchor where the notes belong.
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
 * Builds a source whose consolidation wrote the notes at the anchor.
 *
 * @param notes - what the consolidation wrote at slice 1
 *
 * @returns Narrow artifact source read by the publication assembler
 *
 * @example
 * ```ts
 * const artifact = consolidating({ notes: '[^1]: A note.', },);
 * ```
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

await describe({
  name: guardPageAssembly.name,
  children: [
    it({
      name: 'TRIMS the orphan out of the consolidation\'s two notes one line apart and records the text the '
        + 'page carries (the twenty-second hakureico pass of 2026-09-09 shipped the consolidation\'s fresh '
        + 'rendering of both notes and the page guard refused the page)',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: consolidating({ notes: '[^1]: That is its favourite spot.\n[^2]: A sparrow.', },),
          slices: SLICES,
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
          targetText: TARGET,
        },);
        expect(assembly,).toEqual({ trimmed: [], withdrawn: [], findings: [], },);
      },
    },),
  ],
},);
