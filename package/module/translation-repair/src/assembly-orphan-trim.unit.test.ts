/**
 * Tests for the orphan-definition trim the assembly guard runs before it
 * withdraws.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cutDefinitionBlocks,
  definitionBlockCount,
  type FootnoteGraphFinding,
  isDefinitionTrim,
  trimOrphanDefinitions,
} from '../dist/final/node/index.mjs';

/**
 * Finding naming the second note as an orphan.
 */
const ORPHAN_TWO: FootnoteGraphFinding = {
  kind: 'orphan-definition',
  convention: 'gfm',
  identifier: '2',
  nodeId: 'block/3',
};

/**
 * Two definitions in one insertion, the second unreferenced.
 */
const TWO_NOTES = '[^1]: That is its favourite spot.\n\n[^2]: A sparrow.\n';

/**
 * Incumbent map with nothing under the insertion's index.
 */
const NO_INCUMBENT: ReadonlyMap<string, string> = new Map();

await describe({
  name: trimOrphanDefinitions.name,
  children: [
    it({
      name: 'leaves every replacement alone when no finding names an orphan',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [{
            kind: 'unresolved-reference',
            convention: 'gfm',
            identifier: '1',
            nodeId: 'block/0',
          },],
          replacements: [{ sliceIndex: 1, replacementText: TWO_NOTES, },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.trimmed,).toBe(false,);
        expect(trimmed.findings,).toEqual([],);
        expect(trimmed.replacements,).toEqual([{ sliceIndex: 1, replacementText: TWO_NOTES, },],);
      },
    },),
    it({
      name: 'cuts the orphan block out of a definitions-only replacement and keeps the trailing break',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [ORPHAN_TWO,],
          replacements: [{ sliceIndex: 1, replacementText: TWO_NOTES, },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.trimmed,).toBe(true,);
        expect(trimmed.withdrawn,).toEqual([],);
        expect(trimmed.replacements,).toEqual([{
          sliceIndex: 1,
          replacementText: '[^1]: That is its favourite spot.\n',
        },],);
        expect(trimmed.findings,).toEqual(['assembly-footnote-trimmed orphan-definition gfm 2 (slice 1)',],);
      },
    },),
    it({
      name: 'keeps no trailing break when the replacement had none',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [ORPHAN_TWO,],
          replacements: [{ sliceIndex: 1, replacementText: TWO_NOTES.trimEnd(), },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.replacements,).toEqual([{
          sliceIndex: 1,
          replacementText: '[^1]: That is its favourite spot.',
        },],);
      },
    },),
    it({
      name: 'leaves a replacement whose every block is an orphan for the guard to withdraw',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [ORPHAN_TWO,],
          replacements: [{ sliceIndex: 1, replacementText: '[^2]: A sparrow.\n', },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.trimmed,).toBe(false,);
        expect(trimmed.replacements,).toEqual([{ sliceIndex: 1, replacementText: '[^2]: A sparrow.\n', },],);
      },
    },),
    it({
      name: 'leaves a replacement that carries prose beside its definitions, since a cut would ship judged '
        + 'prose nobody judged in that shape',
      fn: async () => {
        /**
         * Prose paragraph ahead of the notes.
         */
        const prose = `The bird sat there.\n\n${TWO_NOTES}`;
        const trimmed = trimOrphanDefinitions({
          findings: [ORPHAN_TWO,],
          replacements: [{ sliceIndex: 1, replacementText: prose, },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.trimmed,).toBe(false,);
        expect(trimmed.replacements,).toEqual([{ sliceIndex: 1, replacementText: prose, },],);
      },
    },),
    it({
      name: 'withdraws a replacement whose trim lands on its own incumbent, since the document carries no '
        + 'change there',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [ORPHAN_TWO,],
          replacements: [{ sliceIndex: 3, replacementText: TWO_NOTES, },],
          incumbentBySlice: new Map([['3', '[^1]: That is its favourite spot.\n',],],),
        },);
        expect(trimmed.trimmed,).toBe(true,);
        expect(trimmed.withdrawn,).toEqual([3,],);
        expect(trimmed.replacements,).toEqual([],);
        expect(trimmed.findings,).toEqual([
          'assembly-footnote-trimmed orphan-definition gfm 2 (slice 3)',
          'assembly-footnote-trimmed-to-incumbent (slice 3)',
        ],);
      },
    },),
    it({
      name: 'trims only GFM orphans, since only GFM definitions open a block with the label',
      fn: async () => {
        const trimmed = trimOrphanDefinitions({
          findings: [{
            kind: 'orphan-definition',
            convention: 'fullwidth-bracket',
            identifier: '2',
            nodeId: 'block/3',
          },],
          replacements: [{ sliceIndex: 1, replacementText: TWO_NOTES, },],
          incumbentBySlice: NO_INCUMBENT,
        },);
        expect(trimmed.trimmed,).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: cutDefinitionBlocks.name,
  children: [
    it({
      name: 'cuts every block carrying a named label and leaves prose and other definitions in place',
      fn: async () => {
        expect(cutDefinitionBlocks({
          text: `The cat naps[^1].\n\n${TWO_NOTES}`,
          labels: new Set(['2',],),
        },),).toBe('The cat naps[^1].\n\n[^1]: That is its favourite spot.\n',);
      },
    },),
  ],
},);

await describe({
  name: isDefinitionTrim.name,
  children: [
    it({
      name: 'READS a carried text that is the decided text with a definition block cut as a trim',
      fn: async () => {
        expect(isDefinitionTrim({
          decided: TWO_NOTES,
          carried: '[^1]: That is its favourite spot.\n',
        },),).toBe(true,);
        expect(isDefinitionTrim({
          decided: `The cat naps[^1].\n\n${TWO_NOTES}`,
          carried: 'The cat naps[^1].\n\n[^1]: That is its favourite spot.\n',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES an unchanged text, a rewrite, a cut of prose, and a text trimmed to nothing',
      fn: async () => {
        expect(isDefinitionTrim({ decided: TWO_NOTES, carried: TWO_NOTES, },),).toBe(false,);
        expect(isDefinitionTrim({
          decided: TWO_NOTES,
          carried: '[^1]: That is its favourite place.\n',
        },),).toBe(false,);
        expect(isDefinitionTrim({
          decided: `The cat naps[^1].\n\n${TWO_NOTES}`,
          carried: TWO_NOTES,
        },),).toBe(false,);
        expect(isDefinitionTrim({ decided: TWO_NOTES, carried: '', },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: definitionBlockCount.name,
  children: [
    it({
      name: 'counts definition blocks across every replacement and none of the prose',
      fn: async () => {
        expect(definitionBlockCount({
          replacements: [
            { sliceIndex: 0, replacementText: 'The cat naps[^1].\n\n[^1]: A spot.', },
            { sliceIndex: 1, replacementText: TWO_NOTES, },
            { sliceIndex: 2, replacementText: 'Only prose.', },
          ],
        },),).toBe(3,);
      },
    },),
  ],
},);
