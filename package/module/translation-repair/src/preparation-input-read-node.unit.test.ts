import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputNode,
  preparationInputParentSide,
  preparationInputProtection,
  preparationInputProtectionIntersection,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';
const hash = 'a'.repeat(64);
const node = { id: 'block/1', kind: 'custom-node-kind', zone: 'body', startOffset: 10, endOffset: 20, contentHash: hash };
const side = { startOffset: 10, endOffset: 20, hash, nodes: [node] };
const intersection = { startOffset: 10, endOffset: 20, noteHash: hash };
const protection = { intersections: [intersection], sealedTargetNodeIds: ['block/1'], straddlingNodeIds: ['block/2'], allTargetNodesSealed: false };

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

await describe({ name: 'persisted node and protection data', children: [
  ...['body', 'footnote-definition'].map(zone => it({ name: `reads extensible node kind in ${zone}`, fn: async () => {
    const value = { ...node, zone };
    const result = preparationInputNode({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
  } })),
  ...['other/1', 'block/', 'block/01', 'block/-1', 'block/1.5', 'block/Infinity', 'block/9007199254740992'].map(id => it({ name: `refuses node identity ${id}`, fn: async () => {
    expect(refused(() => preparationInputNode({ value: { ...node, id }, path })).kind).toBe('input-relations');
  } })),
  it({ name: 'rejects unsupported zone, blank kind, invalid interval and unknown fields', fn: async () => {
    refused(() => preparationInputNode({ value: { ...node, zone: 'metadata' }, path }));
    refused(() => preparationInputNode({ value: { ...node, kind: '' }, path }));
    refused(() => preparationInputNode({ value: { ...node, endOffset: 9 }, path }));
    refused(() => preparationInputNode({ value: { ...node, contentHash: 'q7z9k2' }, path }));
    refused(() => preparationInputNode({ value: { ...node, text: 'q7z9k2' }, path }));
  } }),
  ...Object.keys(node).map(key => it({ name: `requires node field ${key}`, fn: async () => {
    const value = { ...node };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputNode({ value, path }));
  } })),
  it({ name: 'keeps parent-side hash distinct from omitted node text and freezes membership', fn: async () => {
    const result = preparationInputParentSide({ value: side, path });
    expect(result).toEqual(side);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nodes)).toBe(true);
    expect(Object.isFrozen(result.nodes[0])).toBe(true);
    const empty = { ...side, startOffset: 0, endOffset: 0, nodes: [] };
    expect(preparationInputParentSide({ value: empty, path })).toEqual(empty);
  } }),
  it({ name: 'rejects duplicated or uncontained parent nodes and inverted parent extent', fn: async () => {
    refused(() => preparationInputParentSide({ value: { ...side, nodes: [node, node] }, path }));
    refused(() => preparationInputParentSide({ value: { ...side, nodes: [{ ...node, startOffset: 9 }] }, path }));
    refused(() => preparationInputParentSide({ value: { ...side, nodes: [{ ...node, endOffset: 21 }] }, path }));
    refused(() => preparationInputParentSide({ value: { ...side, startOffset: 21 }, path }));
  } }),
  ...Object.keys(side).map(key => it({ name: `requires parent-side field ${key}`, fn: async () => {
    const value = { ...side };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputParentSide({ value, path }));
  } })),
  it({ name: 'preserves existing protection intervals without reordering coordinates', fn: async () => {
    const result = preparationInputProtectionIntersection({ value: intersection, path });
    expect(result).toEqual(intersection);
    expect(Object.isFrozen(result)).toBe(true);
    refused(() => preparationInputProtectionIntersection({ value: { ...intersection, startOffset: 21 }, path }));
    refused(() => preparationInputProtectionIntersection({ value: { ...intersection, noteHash: 'q7z9k2' }, path }));
    refused(() => preparationInputProtectionIntersection({ value: { ...intersection, note: 'q7z9k2' }, path }));
  } }),
  ...Object.keys(intersection).map(key => it({ name: `requires protection-intersection field ${key}`, fn: async () => {
    const value = { ...intersection };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputProtectionIntersection({ value, path }));
  } })),
  it({ name: 'keeps sealed and straddling roles independent until whole-DTO relation checks', fn: async () => {
    const result = preparationInputProtection({ value: protection, path });
    expect(result).toEqual(protection);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.intersections)).toBe(true);
    expect(Object.isFrozen(result.intersections[0])).toBe(true);
    expect(Object.isFrozen(result.sealedTargetNodeIds)).toBe(true);
    expect(Object.isFrozen(result.straddlingNodeIds)).toBe(true);
    const empty = { intersections: [], sealedTargetNodeIds: [], straddlingNodeIds: [], allTargetNodesSealed: false };
    expect(preparationInputProtection({ value: empty, path })).toEqual(empty);
  } }),
  it({ name: 'rejects duplicated protection identities without inventing a repaired collection', fn: async () => {
    refused(() => preparationInputProtection({ value: { ...protection, sealedTargetNodeIds: ['block/1', 'block/1'] }, path }));
    refused(() => preparationInputProtection({ value: { ...protection, straddlingNodeIds: ['block/2', 'block/2'] }, path }));
    refused(() => preparationInputProtection({ value: { ...protection, allTargetNodesSealed: 'false' }, path }));
  } }),
  ...Object.keys(protection).map(key => it({ name: `requires protection field ${key}`, fn: async () => {
    const value = { ...protection };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputProtection({ value, path }));
  } })),
] });
