import assert from 'node:assert/strict';
import {
  describe,
  it,
} from 'node:test';
import { toJs } from './index.ts';

describe('empty', async () => {
  it('toml', async () => {
    assert.deepStrictEqual(
      await toJs('', 'index.toml'),
      'export default Object.freeze(Object.fromEntries([]))',
    );
  });

  it('json', async () => {
    assert.deepStrictEqual(
      await toJs('{}', 'index.json'),
      'export default Object.freeze(Object.fromEntries([]))',
    );
  });

  it('jsonl', async () => {
    assert.deepStrictEqual(
      await toJs('{}', 'index.jsonl'),
      'export default Object.freeze([Object.freeze(Object.fromEntries([]))])',
    );
  });
});

// TODO: Write other test suites.
