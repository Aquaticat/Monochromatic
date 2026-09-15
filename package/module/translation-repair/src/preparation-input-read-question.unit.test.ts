import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { blockPairingProtocol, } from '../dist/final/node/index.mjs';
import {
  preparationInputNumberedBlock,
  preparationInputNumberedBlocks,
  preparationInputQuestion,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.registry[0].question';
function question({ source = ['Cat'], target = ['Chat'] }: {
  readonly source?: readonly string[];
  readonly target?: readonly string[];
} = {}): ReturnType<typeof preparationInputQuestion> {
  const sourceBlocks = source.map((text, index) => ({ index, text }));
  const targetBlocks = target.map((text, index) => ({ index, text }));
  return { sourceBlocks, targetBlocks, protocol: blockPairingProtocol({ sourceBlocks, targetBlocks }) };
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

await describe({ name: 'persisted native numbered questions', children: [
  it({ name: 'preserves zero-based indexes and arbitrary block text without renumbering', fn: async () => {
    const value = [{ index: 0, text: '' }, { index: 1, text: 'Cat\u0000Dog\r\n``` "quote" \\ tail' }];
    const result = preparationInputNumberedBlocks({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[1])).toBe(true);
    expect(preparationInputNumberedBlocks({ value: [], path })).toEqual([]);
  } }),
  ...['index', 'text'].map(key => it({ name: `requires numbered-block ${key}`, fn: async () => {
    const value = { index: 0, text: 'Cat' };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputNumberedBlock({ value, path }));
  } })),
  it({ name: 'rejects unsupported numbered fields, types and index domains', fn: async () => {
    refused(() => preparationInputNumberedBlock({ value: { index: 0, text: 'Cat', id: 'block/0' }, path }));
    refused(() => preparationInputNumberedBlock({ value: { index: -1, text: 'Cat' }, path }));
    refused(() => preparationInputNumberedBlock({ value: { index: 0, text: 1 }, path }));
    refused(() => preparationInputNumberedBlocks({ value: {}, path }));
  } }),
  ...[[1], [0, 2], [0, 0], [1, 0]].map(indexes => it({ name: `rejects noncontiguous numbering ${indexes.join(',')}`, fn: async () => {
    const value = indexes.map(index => ({ index, text: 'Cat' }));
    expect(refused(() => preparationInputNumberedBlocks({ value, path })).kind).toBe('input-relations');
  } })),
  ...[
    { source: [], target: [] },
    { source: [], target: ['Chat'] },
    { source: ['Cat'], target: [] },
    { source: [''], target: [''] },
    { source: ['Cat\u0000Dog', '```\n猫😺'], target: ['Chat "quote" \\ tail', '````\r\nEnd'] },
  ].map((sides, index) => it({ name: `rebuilds native question fixture ${String(index)} without dispatch assumptions`, fn: async () => {
    const value = question(sides);
    const result = preparationInputQuestion({ value, path });
    expect(result).toEqual(value);
    expect(result).not.toBe(value);
    expect(result.sourceBlocks).not.toBe(value.sourceBlocks);
    expect(result.targetBlocks).not.toBe(value.targetBlocks);
    expect(result.protocol).not.toBe(value.protocol);
    expect(Object.isFrozen(result)).toBe(true);
    const pending: object[] = [result];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) throw new Error('Fixture walk requires an object');
      expect(Object.isFrozen(current)).toBe(true);
      for (const child of Object.values(current)) {
        if ((child !== null) && (typeof child === 'object')) pending.push(child);
      }
    }
    expect(Object.isFrozen(value.protocol)).toBe(false);
    expect(Object.isFrozen(value.protocol.responseFormat.json_schema.schema)).toBe(false);
    expect(question(sides)).toEqual(value);
  } })),
  ...['sourceBlocks', 'targetBlocks', 'protocol'].map(key => it({ name: `requires question field ${key}`, fn: async () => {
    const value = question();
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputQuestion({ value, path }));
  } })),
  it({ name: 'rejects outcome and interpretation fields instead of granting them question authority', fn: async () => {
    refused(() => preparationInputQuestion({ value: { ...question(), outcomes: [] }, path }));
    refused(() => preparationInputQuestion({ value: { ...question(), freeOrder: { source: [], target: [] } }, path }));
  } }),
] });
