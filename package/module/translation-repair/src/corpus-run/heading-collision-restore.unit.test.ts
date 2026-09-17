/**
 Guards class forty-five (hulicaijia6, 2026-09-17): a heading a lane rewrote
 into another section's heading is restored to the archive's own heading at
 page assembly, so the page keeps as many distinct headings as the original
 and the entry does not die at publish. Cat-themed invention throughout; no
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
  guardPageAssembly,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 Original with two sections.
 */
const SOURCE_TEXT = '## 小猫\n\n它睡了。\n\n## 大猫\n\n它醒了。\n';

/**
 Archive rendering both sections under distinct headings.
 */
const FIRST = '## Kitten\n\nIt sleeps.';

/**
 Second archive section.
 */
const SECOND = '## Tomcat\n\nIt wakes.';

/**
 Whole archive page.
 */
const TARGET = `${FIRST}\n\n${SECOND}\n`;

/**
 Two content slices, one per section.
 */
const SLICES: readonly ChunkPair[] = [
  {
    source: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: 11,
      text: '## 小猫\n\n它睡了。',
    },
    target: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: FIRST.length,
      text: FIRST,
    },
  },
  {
    source: {
      kind: 'content',
      sliceIndex: 1,
      nodes: [],
      startOffset: 13,
      endOffset: 24,
      text: '## 大猫\n\n它醒了。',
    },
    target: {
      kind: 'content',
      sliceIndex: 1,
      nodes: [],
      startOffset: FIRST.length + 2,
      endOffset: FIRST.length + 2 + SECOND.length,
      text: SECOND,
    },
  },
];

/**
 Builds a source whose consolidation settled the second section on the given
 text and left the first as the archive has it.

 @param second - what ships for the second section

 @returns Narrow artifact source read by the publication assembler

 @example
 ```ts
 const artifact = settledOn({ second: '## Kitten\n\nIt wakes.', },);
 ```
 */
function settledOn({ second, }: { readonly second: string; },): WouldShipSource {
  return {
    comparison: [
      {
        sliceIndex: 0,
        incumbentKind: 'present',
        incumbentText: FIRST,
        repairText: FIRST,
        translateText: FIRST,
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'decided', acceptedText: FIRST, },
        translateOutcome: { kind: 'decided', acceptedText: FIRST, },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'incumbent-retained', },
        translateDelivery: { kind: 'incumbent-retained', },
      },
      {
        sliceIndex: 1,
        incumbentKind: 'present',
        incumbentText: SECOND,
        repairText: second,
        translateText: second,
        laneRelation: 'both-kept',
        repairOutcome: { kind: 'decided', acceptedText: second, },
        translateOutcome: { kind: 'decided', acceptedText: second, },
        decisionComparison: { kind: 'comparable', verdict: 'same', },
        repairDelivery: { kind: 'incumbent-retained', },
        translateDelivery: { kind: 'incumbent-retained', },
      },
    ],
    consolidation: {
      kind: 'settled',
      slices: [{
        sliceIndex: 1,
        terminal: 'consolidated',
        shipped: { kind: 'consolidated', text: second, },
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
  name: 'colliding headings restored at page assembly (class forty-five)',
  children: [
    it({
      name: 'RESTORES the archive heading of a section whose rendering repeats another section\'s heading',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: settledOn({ second: '## Kitten\n\nIt wakes.', },),
          slices: SLICES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET,
        },);
        expect(assembly.withdrawn,).toEqual([],);
        expect(assembly.trimmed,).toEqual([{
          sliceIndex: 1,
          replacementText: '## Tomcat\n\nIt wakes.',
        },],);
        expect(assembly.findings.join('\n',),).toContain('Kitten',);
        expect(assembly.findings.join('\n',),).toContain('Tomcat',);
      },
    },),
    it({
      name: 'LEAVES distinct headings alone',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: settledOn({ second: '## Big Cat\n\nIt wakes.', },),
          slices: SLICES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET,
        },);
        expect(assembly,).toEqual({ trimmed: [], withdrawn: [], findings: [], },);
      },
    },),
    it({
      name: 'SAYS NOTHING when the page carries fewer headings than the original, which another floor owns',
      fn: async () => {
        const assembly = guardPageAssembly({
          artifact: settledOn({ second: 'It wakes.', },),
          slices: SLICES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET,
        },);
        expect(assembly.trimmed,).toEqual([],);
      },
    },),
  ],
},);
