import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingProtocol,
  buildBlockPairingMessages,
  type JsonSchemaResponseFormat,
} from '../dist/final/node/index.mjs';

const expectedFormat: JsonSchemaResponseFormat = {
  type: 'json_schema', json_schema: { name: 'block_pairing', schema: {
    type: 'object', properties: { pairs: { type: 'array', items: {
      type: 'object', properties: { source: { type: 'integer' }, target: { type: 'integer' } },
      required: ['source', 'target'],
    } } }, required: ['pairs'],
  } },
};

await describe({ name: blockPairingProtocol.name, children: [
  it({ name: 'shares exact existing messages and schema without inventing a receipt identity', fn: async () => {
    const sourceBlocks = [{ index: 0, text: '猫。' }, { index: 1, text: '盒子。' }];
    const targetBlocks = [{ index: 0, text: 'Cat.' }, { index: 1, text: 'Box.' }];
    const protocol = blockPairingProtocol({ sourceBlocks, targetBlocks });
    expect(protocol.messages).toEqual(buildBlockPairingMessages({ sourceBlocks, targetBlocks }));
    expect(protocol.responseFormat).toEqual(expectedFormat);
    expect(Object.keys(protocol).toSorted()).toEqual(['messages', 'responseFormat']);
    expect('strict' in protocol.responseFormat.json_schema).toBe(false);
  } }),
  it({ name: 'retains content-sensitive fences, supplied numbering, escapes and Unicode text', fn: async () => {
    const sourceBlocks = [{ index: 7, text: '```\n“猫” \\[note]。\n````\nSecond line.' }] as const;
    const targetBlocks = [{ index: 2, text: 'A cat.\n```\nQuoted `markup`.' }];
    const protocol = blockPairingProtocol({ sourceBlocks, targetBlocks });
    expect(protocol.messages).toEqual(buildBlockPairingMessages({ sourceBlocks, targetBlocks }));
    expect(JSON.stringify(protocol.messages)).toContain('“猫”');
    expect(blockPairingProtocol({ sourceBlocks: [{ index: 8, text: sourceBlocks[0].text }], targetBlocks }).messages).not.toEqual(protocol.messages);
    expect(blockPairingProtocol({ sourceBlocks, targetBlocks: [{ index: 2, text: 'Changed cat.' }] }).messages).not.toEqual(protocol.messages);
  } }),
  it({ name: 'owns the response schema so one consumer cannot change later acquisition contracts', fn: async () => {
    const input = { sourceBlocks: [{ index: 0, text: '猫。' }], targetBlocks: [{ index: 0, text: 'Cat.' }] };
    const first = blockPairingProtocol(input);
    Object.defineProperty(first.responseFormat.json_schema, 'name', { value: 'altered-fixture-schema' });
    first.responseFormat.json_schema.schema.extraFixtureProperty = true;
    const later = blockPairingProtocol(input);
    expect(later.responseFormat).toEqual(expectedFormat);
    expect(later.responseFormat).not.toBe(first.responseFormat);
    expect(later.responseFormat.json_schema.schema).not.toBe(first.responseFormat.json_schema.schema);
  } }),
] });
