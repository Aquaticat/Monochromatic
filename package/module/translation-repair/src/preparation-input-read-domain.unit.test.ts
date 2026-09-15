import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputDefinitionDomain,
  preparationInputDefinitionIds,
  preparationInputDefinitionIndexes,
  preparationInputDefinitionOrder,
  preparationInputNodeId,
  preparationInputQuestionAliases,
  preparationInputUnalignedDefinitions,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';
const hash = 'a'.repeat(64);
const definition = { id: 'block/1', kind: 'footnoteDefinition', zone: 'footnote-definition', startOffset: 10, endOffset: 20, contentHash: hash };
const namespace = { scope: 'unaligned-definition-namespace', entryId: 'Cat', source: [definition], target: [] };
const aliases = { questionDigest: hash, parentIds: ['Cat/source-section/0/target-section/0', 'Dog/source-section/1/target-section/2'] };
function refused(fn: () => unknown): void {
  try {
    fn();
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.message).not.toContain('q7z9k2');
    return;
  }
  expect(false).toBe(true);
}

await describe({ name: 'persisted definition and alias scope', children: [
  ...['block/0', 'block/10'].map(value => it({ name: `reads canonical node identity ${value}`, fn: async () => {
    expect(preparationInputNodeId({ value, path })).toBe(value);
  } })),
  ...['', 'block/', 'block/01', 'block/-0', 'block/1.5', 'block/9007199254740992', 'other/1'].map(value => it({ name: `refuses noncanonical node identity ${JSON.stringify(value)}`, fn: async () => {
    refused(() => preparationInputNodeId({ value, path }));
  } })),
  it({ name: 'retains unique definition IDs without lexically sorting their numeric suffixes', fn: async () => {
    const value = ['block/2', 'block/10'];
    const result = preparationInputDefinitionIds({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    refused(() => preparationInputDefinitionIds({ value: ['block/2', 'block/2'], path }));
    refused(() => preparationInputDefinitionIds({ value: ['q7z9k2'], path }));
  } }),
  ...[
    { sourceIds: [], targetIds: [] },
    { sourceIds: ['block/0'], targetIds: [] },
    { sourceIds: [], targetIds: ['block/0'] },
    { sourceIds: ['block/0'], targetIds: ['block/0'] },
  ].map((value, index) => it({ name: `preserves independent definition-domain fixture ${String(index)}`, fn: async () => {
    const result = preparationInputDefinitionDomain({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sourceIds)).toBe(true);
    expect(Object.isFrozen(result.targetIds)).toBe(true);
  } })),
  ...['sourceIds', 'targetIds'].map(key => it({ name: `requires definition-domain ${key}`, fn: async () => {
    const value = { sourceIds: [], targetIds: [] };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputDefinitionDomain({ value, path }));
  } })),
  it({ name: 'retains increasing local indexes with legitimate body-node gaps', fn: async () => {
    const value = [0, 2, 5];
    const result = preparationInputDefinitionIndexes({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(preparationInputDefinitionIndexes({ value: [], path })).toEqual([]);
  } }),
  ...[[1, 0], [0, 0], [-1], [0.5], ['block/0']].map((value, index) => it({ name: `refuses local definition-index fixture ${String(index)}`, fn: async () => {
    refused(() => preparationInputDefinitionIndexes({ value, path }));
  } })),
  it({ name: 'preserves corrected explicit arrays and rejects the historical lost-Set objects', fn: async () => {
    const value = { source: [1, 3], target: [0] };
    const result = preparationInputDefinitionOrder({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.source)).toBe(true);
    expect(Object.isFrozen(result.target)).toBe(true);
    expect(preparationInputDefinitionOrder({ value: { source: [], target: [] }, path })).toEqual({ source: [], target: [] });
    refused(() => preparationInputDefinitionOrder({ value: { source: {}, target: {} }, path }));
    refused(() => preparationInputDefinitionOrder({ value: { source: [], target: [], authority: 'q7z9k2' }, path }));
  } }),
  ...['source', 'target'].map(key => it({ name: `requires definition-order ${key}`, fn: async () => {
    const value = { source: [], target: [] };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputDefinitionOrder({ value, path }));
  } })),
  ...[
    namespace,
    { ...namespace, source: [], target: [definition] },
    { ...namespace, target: [{ ...definition, startOffset: 100, endOffset: 110 }] },
  ].map((value, index) => it({ name: `retains nonempty unaligned namespace fixture ${String(index)}`, fn: async () => {
    const result = preparationInputUnalignedDefinitions({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.source)).toBe(true);
    expect(Object.isFrozen(result.target)).toBe(true);
  } })),
  it({ name: 'rejects empty, body-bearing or duplicate-node namespaces without inventing questions', fn: async () => {
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, source: [] }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, source: [{ ...definition, zone: 'body' }] }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, target: [{ ...definition, zone: 'body' }] }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, source: [definition, definition] }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, target: [definition, definition] }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, scope: 'pairing-authority' }, path }));
    refused(() => preparationInputUnalignedDefinitions({ value: { ...namespace, question: 'q7z9k2' }, path }));
  } }),
  ...Object.keys(namespace).map(key => it({ name: `requires unaligned namespace ${key}`, fn: async () => {
    const value = { ...namespace };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputUnalignedDefinitions({ value, path }));
  } })),
  it({ name: 'keeps alias parent references in their declared order without granting receipt authority', fn: async () => {
    const result = preparationInputQuestionAliases({ value: aliases, path });
    expect(result).toEqual(aliases);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.parentIds)).toBe(true);
  } }),
  ...[[], ['Cat'], ['Cat', 'Cat']].map((parentIds, index) => it({ name: `refuses nonshared alias group ${String(index)}`, fn: async () => {
    refused(() => preparationInputQuestionAliases({ value: { ...aliases, parentIds }, path }));
  } })),
  ...Object.keys(aliases).map(key => it({ name: `requires question-alias ${key}`, fn: async () => {
    const value = { ...aliases };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputQuestionAliases({ value, path }));
  } })),
  it({ name: 'rejects malformed alias digests and historical cache authority fields', fn: async () => {
    refused(() => preparationInputQuestionAliases({ value: { ...aliases, questionDigest: 'q7z9k2' }, path }));
    refused(() => preparationInputQuestionAliases({ value: { ...aliases, questionKey: hash }, path }));
    refused(() => preparationInputQuestionAliases({ value: { ...aliases, parentIds: ['', 'Dog'] }, path }));
    refused(() => preparationInputDefinitionDomain({ value: { sourceIds: [], targetIds: [], authority: 'q7z9k2' }, path }));
  } }),
] });
