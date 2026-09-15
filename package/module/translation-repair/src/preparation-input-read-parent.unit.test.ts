import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputParent,
  preparationInputPopulationParent,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';
function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
function fixture(): ReturnType<typeof preparationInputParent> {
  return {
    id: 'Cat/source-section/2/target-section/1', entryId: 'Cat', index: 2, pairIndex: 0,
    sourceSectionIndex: 2, targetSectionIndex: 1, sourceText: 'Cat', incumbentText: 'Cat Dog Owl',
    source: { startOffset: 10, endOffset: 13, hash: hash('Cat'), nodes: [{ id: 'block/1', kind: 'paragraph', zone: 'body', startOffset: 10, endOffset: 13, contentHash: hash('Cat') }] },
    target: { startOffset: 100, endOffset: 111, hash: hash('Cat Dog Owl'), nodes: [
      { id: 'block/5', kind: 'paragraph', zone: 'body', startOffset: 100, endOffset: 103, contentHash: hash('Cat') },
      { id: 'block/6', kind: 'paragraph', zone: 'body', startOffset: 104, endOffset: 107, contentHash: hash('Dog') },
      { id: 'block/7', kind: 'paragraph', zone: 'body', startOffset: 108, endOffset: 111, contentHash: hash('Owl') },
    ] },
    originalProtection: { intersections: [{ startOffset: 99, endOffset: 105, noteHash: hash('First note') }, { startOffset: 108, endOffset: 112, noteHash: hash('Next note') }], sealedTargetNodeIds: ['block/5', 'block/7'], straddlingNodeIds: ['block/6'], allTargetNodesSealed: false },
  };
}
function population(): ReturnType<typeof preparationInputPopulationParent> {
  const parent = fixture();
  return { id: parent.id, entryId: parent.entryId, pairIndex: parent.pairIndex, sourceSectionIndex: parent.sourceSectionIndex, targetSectionIndex: parent.targetSectionIndex, source: parent.source, target: parent.target, originalProtection: parent.originalProtection };
}
function refused(fn: () => unknown): PreparationRootError {
  try {
    fn();
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.message).not.toContain('q7z9k2');
    return error;
  }
  expect(false).toBe(true);
  throw new Error('Unreachable after missing-refusal assertion');
}

await describe({ name: 'persisted population and complete parents', children: [
  it({ name: 'retains separate side indexes, pair position and unclipped protection intervals', fn: async () => {
    const value = fixture();
    const result = preparationInputParent({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.source)).toBe(true);
    expect(Object.isFrozen(result.target.nodes)).toBe(true);
    expect(Object.isFrozen(result.originalProtection.intersections)).toBe(true);
    expect(result.originalProtection.intersections[0]?.startOffset).toBe(99);
    const row = population();
    expect(preparationInputPopulationParent({ value: row, path })).toEqual(row);
  } }),
  it({ name: 'keeps population and complete-parent key inventories distinct', fn: async () => {
    refused(() => preparationInputParent({ value: population(), path }));
    refused(() => preparationInputPopulationParent({ value: fixture(), path }));
    refused(() => preparationInputParent({ value: { ...fixture(), approval: true }, path }));
    refused(() => preparationInputPopulationParent({ value: { ...population(), approval: true }, path }));
  } }),
  ...Object.keys(fixture()).map(key => it({ name: `requires complete-parent ${key}`, fn: async () => {
    const value = fixture();
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputParent({ value, path }));
  } })),
  ...Object.keys(population()).map(key => it({ name: `requires population-parent ${key}`, fn: async () => {
    const value = population();
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputPopulationParent({ value, path }));
  } })),
  it({ name: 'rejects noncanonical identity and source-index alias mismatches', fn: async () => {
    refused(() => preparationInputPopulationParent({ value: { ...population(), id: 'Cat/source-section/02/target-section/1' }, path }));
    refused(() => preparationInputParent({ value: { ...fixture(), index: 0 }, path }));
    refused(() => preparationInputParent({ value: { ...fixture(), entryId: 'OtherCat' }, path }));
  } }),
  ...['sealedTargetNodeIds', 'straddlingNodeIds'].map(key => it({ name: `rejects source-only identity in target ${key}`, fn: async () => {
    const value = population();
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, [key]: ['block/1'] } }, path }));
  } })),
  it({ name: 'rejects reordered membership and overlap between sealed and straddling roles', fn: async () => {
    const value = population();
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, sealedTargetNodeIds: ['block/7', 'block/5'] } }, path }));
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, straddlingNodeIds: ['block/5'] } }, path }));
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, sealedTargetNodeIds: [], straddlingNodeIds: ['block/7', 'block/5'] } }, path }));
  } }),
  it({ name: 'derives the all-sealed summary only from nonempty target membership', fn: async () => {
    const value = fixture();
    refused(() => preparationInputParent({ value: { ...value, originalProtection: { ...value.originalProtection, allTargetNodesSealed: true } }, path }));
    const complete = { ...value, originalProtection: { intersections: [{ startOffset: 99, endOffset: 112, noteHash: hash('Complete note') }], sealedTargetNodeIds: ['block/5', 'block/6', 'block/7'], straddlingNodeIds: [], allTargetNodesSealed: true } };
    expect(preparationInputParent({ value: complete, path })).toEqual(complete);
    refused(() => preparationInputParent({ value: { ...complete, originalProtection: { ...complete.originalProtection, allTargetNodesSealed: false } }, path }));
  } }),
  it({ name: 'preserves empty target anchors and full overlapping intervals without fabricating sealed nodes', fn: async () => {
    const value = { ...fixture(), incumbentText: '', target: { startOffset: 150, endOffset: 150, hash: hash(''), nodes: [] }, originalProtection: { intersections: [{ startOffset: 149, endOffset: 151, noteHash: hash('Empty anchor note') }], sealedTargetNodeIds: [], straddlingNodeIds: [], allTargetNodesSealed: false } };
    expect(preparationInputParent({ value, path })).toEqual(value);
    refused(() => preparationInputParent({ value: { ...value, originalProtection: { ...value.originalProtection, allTargetNodesSealed: true } }, path }));
    const emptySource = { ...value, sourceText: '', source: { startOffset: 25, endOffset: 25, hash: hash(''), nodes: [] } };
    expect(preparationInputParent({ value: emptySource, path })).toEqual(emptySource);
  } }),
  it({ name: 'rejects an intersection that only touches or lies outside the parent target', fn: async () => {
    const value = population();
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, intersections: [{ startOffset: 99, endOffset: 100, noteHash: hash('Outside note') }] } }, path }));
    refused(() => preparationInputPopulationParent({ value: { ...value, originalProtection: { ...value.originalProtection, intersections: [{ startOffset: 111, endOffset: 112, noteHash: hash('Outside note') }] } }, path }));
  } }),
  it({ name: 'checks represented text extent separately from its side hash', fn: async () => {
    const value = fixture();
    refused(() => preparationInputParent({ value: { ...value, sourceText: 'Cat!', source: { ...value.source, hash: hash('Cat!') } }, path }));
    refused(() => preparationInputParent({ value: { ...value, source: { ...value.source, hash: 'f'.repeat(64) } }, path }));
    refused(() => preparationInputParent({ value: { ...value, incumbentText: 'q7z9k2' }, path }));
  } }),
  ...['source', 'target'].map(key => it({ name: `checks ${key} node hashes against represented parent-relative text`, fn: async () => {
    const value = fixture();
    const side = key === 'source' ? value.source : value.target;
    const nodes = side.nodes.map(node => ({ ...node, contentHash: 'b'.repeat(64) }));
    const error = refused(() => preparationInputParent({ value: { ...value, [key]: { ...side, nodes } }, path }));
    expect(error.kind).toBe('input-relations');
  } })),
] });
