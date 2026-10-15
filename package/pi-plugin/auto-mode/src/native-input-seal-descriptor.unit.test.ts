/** Built descriptor checks preserve original array key counting and proxy failure order. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError, seal } from './native-input-seal-fixture.ts';

await describe({ name: 'prepared argument descriptors', children: [
  //region Original descriptor rules reject observations before freezing their container.
  it({ name: 'rejects accessors without invoking their getter and rejects hidden properties and symbols', fn: async function descriptors() {
    const reads: string[] = [];
    const accessor = { get value() { reads.push('unexpected getter invocation');
    return 'unobserved'; } };
    const hidden = Object.defineProperty({}, 'value', { value: 'hidden' });
    const symbol = { [Symbol('unsupported prepared property key')]: 'value' };
    for (const [input, message] of [
      [accessor, 'Prepared input has an accessor'],
      [hidden, 'Prepared input has hidden properties'],
      [symbol, 'Prepared input has a symbol key'],
    ] as const) {
      assert.throws(function invalidDescriptor() { seal(input); }, { message });
      assert.equal(Object.isFrozen(input), false);
    }
    assert.deepEqual(reads, []);
  } }),
  it({ name: 'rejects an own key whose proxy descriptor disappears', fn: async function missingDescriptor() {
    const input = new Proxy({}, { ownKeys() { return ['missing']; } });
    assert.throws(function absentDescriptor() { seal(input); }, { message: 'Prepared input has an accessor' });
    assert.equal(Object.isFrozen(input), false);
  } }),
  it({ name: 'rejects sparse arrays and extra keys but preserves the original compensated-hole behavior', fn: async function arrayShape() {
    const sparse: unknown[] = [];
    sparse.length = 1;
    const extra = Object.defineProperty([], 'extra', { value: true, enumerable: true });
    for (const input of [sparse, extra]) {
      assert.throws(function arrayKeys() { seal(input); }, { message: 'Prepared input array is sparse or has extra properties' });
      assert.equal(Object.isFrozen(input), false);
    }
    const compensated: unknown[] = [];
    compensated.length = 1;
    Object.defineProperty(compensated, 'extra', { value: undefined, enumerable: true });
    assert.equal(seal(compensated), compensated);
    assert.equal(Object.hasOwn(compensated, '0'), false);
    assert.ok(Object.isFrozen(compensated));
    const hidden = [true];
    Object.defineProperty(hidden, '0', { enumerable: false });
    assert.throws(function hiddenArrayIndex() { seal(hidden); }, { message: 'Prepared input has hidden properties' });
  } }),
  //endregion
  //region Proxy observations and opaque exceptions retain their original owner and order.
  it({ name: 'observes descriptors before freezing and visits children after parent freeze', fn: async function proxyOrder() {
    const events: string[] = [];
    const child = new Proxy({}, { getPrototypeOf(target) { events.push('child');
    return Reflect.getPrototypeOf(target); } });
    const input = new Proxy({ child }, {
      getPrototypeOf(target) { events.push('prototype');
      return Reflect.getPrototypeOf(target); },
      ownKeys(target) { events.push('keys');
      return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { events.push(`descriptor:${String(key)}`);
      return Reflect.getOwnPropertyDescriptor(target, key); },
      preventExtensions(target) { events.push('freeze');
      return Reflect.preventExtensions(target); },
      defineProperty(target, key, descriptor) { events.push(`define:${String(key)}`);
      return Reflect.defineProperty(target, key, descriptor); },
    });
    assert.equal(seal(input), input);
    assert.deepEqual(events, ['prototype', 'keys', 'descriptor:child', 'freeze', 'keys', 'descriptor:child', 'define:child', 'child']);
  } }),
  ...['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor', 'preventExtensions', 'defineProperty'].map(function proxyTrap(trap) {
    return it({ name: `preserves an opaque ${trap} failure`, fn: async function trapFailure() {
      const failure: unknown = Object.freeze({ trap });
      const input = new Proxy({ value: true }, { [trap]: function fail() { throw failure; } });
      assert.throws(function originalTrap() { seal(input); }, function sameFailure(error: unknown) { return error === failure; });
      assert.equal(failure instanceof PreparedBatchContractError, false);
    } });
  }),
  //endregion
] });
