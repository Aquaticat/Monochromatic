import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputBytes,
  preparationInputJson,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const text = JSON.stringify({ cats: ['猫', '🐈'], note: 'private fixture q7z9k2' });
const content = new TextEncoder().encode(text);

function failure(fn: () => unknown): PreparationRootError {
  try {
    fn();
  }
  catch (error) {
    if (!(error instanceof PreparationRootError)) throw error;
    return error;
  }
  expect(false).toBe(true);
  throw new Error('Unreachable after missing-refusal assertion');
}

await describe({ name: 'owned preparation input JSON', concurrency: 1, children: [
  it({ name: 'copies bytes and preserves raw identity without interpreting DTO scope', fn: async () => {
    const borrowed = new Uint8Array(content);
    const result = preparationInputJson(borrowed);
    borrowed.fill(0);
    expect(result.value).toEqual({ cats: ['猫', '🐈'], note: 'private fixture q7z9k2' });
    expect(result.identity).toEqual({ bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') });
    expect(Object.isFrozen(result.identity)).toBe(true);
  } }),
  it({ name: 'copies native byte views without own state or iterator access', fn: async ctx => {
    const borrowed = new Uint8Array(content);
    const accessor = ctx.sinon.spy(function refusedAccessor(): never { throw new Error('private accessor q7z9k2'); });
    Object.defineProperties(borrowed, {
      byteLength: { get: accessor },
      length: { get: accessor },
      buffer: { get: accessor },
      [Symbol.iterator]: { get: accessor },
    });
    const copied = preparationInputBytes(borrowed);
    expect([...copied]).toEqual([...content]);
    expect(accessor.callCount).toBe(0);
    expect(copied === borrowed).toBe(false);
  } }),
  ...[
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'array', value: [] },
    { name: 'record', value: {} },
    { name: 'text', value: 'bytes' },
    { name: 'wide typed array', value: new Uint16Array([1]) },
  ].map(({ name, value }) => it({ name: `refuses non-byte input ${name}`, fn: async () => {
    const error = failure(() => Reflect.apply(preparationInputBytes, undefined, [value]));
    expect(error.kind).toBe('input-bytes');
    expect(error.input).toBeUndefined();
    expect(Object.hasOwn(error, 'cause')).toBe(false);
  } })),
  ...[false, true].map(revoked => it({ name: `refuses proxy byte views revoked=${revoked}`, fn: async () => {
    const proxy = Proxy.revocable(new Uint8Array(content), {});
    if (revoked) proxy.revoke();
    const error = failure(() => preparationInputJson(proxy.proxy));
    expect(error.kind).toBe('input-bytes');
    expect(error.message).not.toContain('q7z9k2');
  } })),
  it({ name: 'refuses detached native buffers with fixed byte metadata', fn: async () => {
    const borrowed = new Uint8Array(content);
    structuredClone(borrowed.buffer, { transfer: [borrowed.buffer] });
    const error = failure(() => preparationInputJson(borrowed));
    expect(error.kind).toBe('input-bytes');
    expect(Object.hasOwn(error, 'cause')).toBe(false);
  } }),
  it({ name: 'refuses malformed UTF-8 without replacement characters', fn: async () => {
    const error = failure(() => preparationInputJson(new Uint8Array([0xc3, 0x28])));
    expect(error.kind).toBe('input-bytes');
  } }),
  ...[
    { name: 'duplicate keys', text: '{"cats":1,"cats":2}' },
    { name: 'trailing whitespace', text: '{"cats":1}\n' },
    { name: 'non-native escapes', text: '{"cat":"\\u732b"}' },
    { name: 'number spelling', text: '{"cats":1.0}' },
    { name: 'parser excerpt', text: '{"private marker q7z9k2":' },
  ].map(({ name, text }) => it({ name: `refuses ${name} without exporting contents`, fn: async () => {
    const error = failure(() => preparationInputJson(new TextEncoder().encode(text)));
    expect(error.kind).toBe('input-json');
    expect(error.message).not.toContain('q7z9k2');
    expect(error.input).toBeUndefined();
    expect(Object.hasOwn(error, 'cause')).toBe(false);
  } })),
  it({ name: 'compares canonical raw bytes rather than BOM-stripped text', fn: async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...content]);
    const error = failure(() => preparationInputJson(withBom));
    expect(error.kind).toBe('input-json');
  } }),
  ...(['input-bytes', 'input-json', 'input-shape', 'input-relations'] as const).map(kind => it({ name: `keeps ${kind} diagnostics in the authored vocabulary`, fn: async () => {
    const error = new PreparationRootError({ kind });
    expect(error.kind).toBe(kind);
    expect(error.messageNamesOnly).toBe(true);
    expect(error.message.length).toBeGreaterThan(0);
    expect(Object.hasOwn(error, 'cause')).toBe(false);
  } })),
] });
