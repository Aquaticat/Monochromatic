import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputArray,
  preparationInputBoolean,
  preparationInputDigest,
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputProperty,
  preparationInputRecord,
  preparationInputString,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';

function refused(fn: () => unknown): PreparationRootError {
  try {
    fn();
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.kind).toBe('input-shape');
    expect(error.message).not.toContain('q7z9k2');
    return error;
  }
  expect(false).toBe(true);
  throw new Error('Unreachable after missing-refusal assertion');
}

await describe({ name: 'closed preparation input values', children: [
  it({ name: 'reads complete own-key inventory without promoting field types', fn: async () => {
    const value = { cat: 1 };
    expect(preparationInputRecord({ value, path, keys: ['cat'] })).toBe(value);
    expect(preparationInputProperty({ value, path, key: 'cat' })).toEqual({ value: 1, path: 'inputs.fixture.cat' });
  } }),
  ...[
    { name: 'null', value: null },
    { name: 'array', value: [] },
    { name: 'missing', value: {} },
    { name: 'extra', value: { cat: 1, extra: 'q7z9k2' } },
    { name: 'null prototype', value: Object.assign(Object.create(null), { cat: 1 }) },
    { name: 'symbol field', value: { cat: 1, [Symbol('extra')]: true } },
    { name: 'nonenumerable field', value: Object.defineProperty({ cat: 1 }, 'hidden', { value: 'q7z9k2' }) },
  ].map(({ name, value }) => it({ name: `refuses record ${name}`, fn: async () => {
    expect(refused(() => preparationInputRecord({ value, path, keys: ['cat'] })).input).toBe(path);
  } })),
  it({ name: 'freezes newly decoded arrays while retaining element positions', fn: async () => {
    const value = [0, 1];
    expect(preparationInputArray({ value, path })).toBe(value);
    const result = preparationInputItems({ value, path, read: preparationInputInteger });
    expect(result).toEqual([0, 1]);
    expect(result === value).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    const error = refused(() => preparationInputItems({ value: [0, 'q7z9k2'], path, read: preparationInputInteger }));
    expect(error.input).toBe('inputs.fixture[1]');
  } }),
  it({ name: 'refuses absent collection rather than inventing an empty one', fn: async () => {
    expect(refused(() => preparationInputArray({ value: undefined, path })).input).toBe(path);
  } }),
  ...['', 'cat', ' 猫\n'].map(value => it({ name: `preserves exact text ${JSON.stringify(value)}`, fn: async () => {
    expect(preparationInputString({ value, path })).toBe(value);
  } })),
  it({ name: 'refuses text coercion', fn: async () => {
    refused(() => preparationInputString({ value: 1, path }));
  } }),
  ...[true, false].map(value => it({ name: `reads explicit boolean ${String(value)}`, fn: async () => {
    expect(preparationInputBoolean({ value, path })).toBe(value);
  } })),
  ...['false', 1, null].map(value => it({ name: `refuses boolean coercion ${String(value)}`, fn: async () => {
    refused(() => preparationInputBoolean({ value, path }));
  } })),
  ...[0, 1, Number.MAX_SAFE_INTEGER].map(value => it({ name: `reads safe coordinate ${String(value)}`, fn: async () => {
    expect(preparationInputInteger({ value, path })).toBe(value);
  } })),
  ...[
    { name: 'negative', value: -1 },
    { name: 'negative zero', value: -0 },
    { name: 'fraction', value: 0.5 },
    { name: 'nan', value: NaN },
    { name: 'infinity', value: Infinity },
    { name: 'unsafe', value: Number.MAX_SAFE_INTEGER + 1 },
    { name: 'text', value: '1' },
  ].map(({ name, value }) => it({ name: `refuses coordinate ${name}`, fn: async () => {
    refused(() => preparationInputInteger({ value, path }));
  } })),
  ...([40, 64] as const).map(characters => it({ name: `reads exact ${characters}-character digest grammar`, fn: async () => {
    const value = 'a'.repeat(characters);
    expect(preparationInputDigest({ value, path, characters })).toBe(value);
    refused(() => preparationInputDigest({ value: 'A'.repeat(characters), path, characters }));
    refused(() => preparationInputDigest({ value: 'g'.repeat(characters), path, characters }));
    refused(() => preparationInputDigest({ value: value + 'a', path, characters }));
  } })),
  it({ name: 'keeps record selectors bound to their original supported keys', fn: async () => {
    const keys = ['cat'];
    const field = preparationInputFields({ value: { cat: 1 }, path, keys });
    keys.push('later');
    expect(field('cat')).toEqual({ value: 1, path: 'inputs.fixture.cat' });
    expect(refused(() => field('later')).input).toBe(path);
  } }),
] });
