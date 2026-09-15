import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { blockPairingProtocol, type BlockPairingProtocol, } from '../dist/final/node/index.mjs';
import { preparationInputProtocol, PreparationRootError, } from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.registry[0].question.protocol';
const sourceBlocks = [{ index: 0, text: 'Cat' }];
const targetBlocks = [{ index: 0, text: 'Chat' }, { index: 1, text: 'More chat' }];
function fixture(): BlockPairingProtocol {
  return blockPairingProtocol({ sourceBlocks, targetBlocks });
}
function read(value: unknown): BlockPairingProtocol {
  return preparationInputProtocol({ value, path, sourceBlocks, targetBlocks });
}
function change({ value, key, replacement }: {
  readonly value: unknown;
  readonly key: string;
  readonly replacement: unknown;
}): void {
  if ((typeof value !== 'object') || (value === null)) throw new Error('Fixture needs an object');
  expect(Reflect.set(value, key, replacement)).toBe(true);
}
function field({ value, key }: { readonly value: unknown; readonly key: string }): unknown {
  if ((typeof value !== 'object') || (value === null)) throw new Error('Fixture needs an object');
  return Reflect.get(value, key);
}
function refused(value: unknown): PreparationRootError {
  try {
    read(value);
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

await describe({ name: 'literal native protocol comparison', children: [
  it({ name: 'returns frozen native values without freezing or borrowing supplied objects', fn: async () => {
    const value = fixture();
    const result = read(value);
    expect(result).toEqual(value);
    expect(result).not.toBe(value);
    expect(result.messages).not.toBe(value.messages);
    expect(result.responseFormat).not.toBe(value.responseFormat);
    expect(Object.isFrozen(result.responseFormat.json_schema.schema)).toBe(true);
    expect(Object.isFrozen(value.responseFormat.json_schema.schema)).toBe(false);
    change({ value: value.messages[0], key: 'content', replacement: 'Changed caller-owned text' });
    expect(result).toEqual(fixture());
    expect(read(fixture())).toEqual(result);
  } }),
  ...['messages', 'responseFormat'].map(key => it({ name: `requires protocol field ${key}`, fn: async () => {
    const value = fixture();
    Reflect.deleteProperty(value, key);
    refused(value);
  } })),
  it({ name: 'rejects extra protocol and message fields', fn: async () => {
    refused({ ...fixture(), approval: true });
    const value = fixture();
    change({ value: value.messages[0], key: 'name', replacement: 'q7z9k2' });
    refused(value);
  } }),
  ...['role', 'content'].map(key => it({ name: `compares exact message ${key}`, fn: async () => {
    const value = fixture();
    change({ value: value.messages[0], key, replacement: 'q7z9k2' });
    expect(refused(value).kind).toBe('input-relations');
  } })),
  it({ name: 'rejects reversed or extended message order', fn: async () => {
    const value = fixture();
    refused({ ...value, messages: value.messages.toReversed() });
    refused({ ...value, messages: [...value.messages, { role: 'user', content: 'q7z9k2' }] });
    refused({ ...value, messages: {} });
  } }),
  it({ name: 'rejects sparse, extra-key and alternate-prototype arrays', fn: async () => {
    const value = fixture();
    const sparse = [...value.messages];
    Reflect.deleteProperty(sparse, '0');
    refused({ ...value, messages: sparse });
    const extra = [...value.messages];
    Reflect.set(extra, 'extra', 'q7z9k2');
    refused({ ...value, messages: extra });
    const symbolic = [...value.messages];
    Reflect.deleteProperty(symbolic, '0');
    Reflect.set(symbolic, Symbol('q7z9k2'), 'q7z9k2');
    refused({ ...value, messages: symbolic });
    const otherPrototype = [...value.messages];
    Object.setPrototypeOf(otherPrototype, null);
    refused({ ...value, messages: otherPrototype });
  } }),
  it({ name: 'checks response format discriminator, name and optional-field absence', fn: async () => {
    const typeValue = fixture();
    change({ value: typeValue.responseFormat, key: 'type', replacement: 'q7z9k2' });
    refused(typeValue);
    const nameValue = fixture();
    change({ value: nameValue.responseFormat.json_schema, key: 'name', replacement: 'q7z9k2' });
    refused(nameValue);
    const strictValue = fixture();
    change({ value: strictValue.responseFormat.json_schema, key: 'strict', replacement: false });
    refused(strictValue);
  } }),
  it({ name: 'compares nested response-schema literals without interpreting their schema meanings', fn: async () => {
    const value = fixture();
    const properties = field({ value: value.responseFormat.json_schema.schema, key: 'properties' });
    const pairs = field({ value: properties, key: 'pairs' });
    const items = field({ value: pairs, key: 'items' });
    const itemProperties = field({ value: items, key: 'properties' });
    const source = field({ value: itemProperties, key: 'source' });
    change({ value: source, key: 'type', replacement: 'q7z9k2' });
    expect(refused(value).kind).toBe('input-relations');
    const reordered = fixture();
    const otherProperties = field({ value: reordered.responseFormat.json_schema.schema, key: 'properties' });
    const otherPairs = field({ value: otherProperties, key: 'pairs' });
    const otherItems = field({ value: otherPairs, key: 'items' });
    change({ value: otherItems, key: 'required', replacement: ['target', 'source'] });
    refused(reordered);
  } }),
  it({ name: 'rejects non-record schema shapes and unknown nested fields', fn: async () => {
    const arrayValue = fixture();
    change({ value: arrayValue.responseFormat.json_schema, key: 'schema', replacement: [] });
    refused(arrayValue);
    const extraValue = fixture();
    change({ value: extraValue.responseFormat.json_schema.schema, key: 'q7z9k2', replacement: true });
    refused(extraValue);
    const prototypeValue = fixture();
    Object.setPrototypeOf(prototypeValue.responseFormat.json_schema.schema, null);
    refused(prototypeValue);
  } }),
] });
