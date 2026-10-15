/** Built consumer checks for prepared input admission and original partial freezing. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError, seal } from './native-input-seal-fixture.ts';

await describe({ name: seal.name, children: [
  //region Primitive admission preserves identity and does not serialize values.
  ...[undefined, null, true, false, '', '雪\\\n"', 0, -0, 1.5, Number.MAX_VALUE].map(function validPrimitive(input, index) {
    return it({ name: `retains primitive fixture ${index}`, fn: async function preservePrimitive() {
      assert.ok(Object.is(seal(input), input));
    } });
  }),
  ...[Symbol('argument'), 1n, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, function unsupportedFunction() {}].map(function invalidPrimitive(input, index) {
    return it({ name: `rejects unsupported fixture ${index} in root and child positions`, fn: async function rejectPrimitive() {
      for (const value of [input, [input], { value: input }]) {
        assert.throws(function invalidTree() { seal(value); }, { name: 'Error', message: 'Prepared input must be a non-aliased JSON-like tree' });
        assert.throws(function originalConstructor() { seal(value); }, PreparedBatchContractError);
      }
    } });
  }),
  //endregion
  //region Structural admission retains original prototypes, identity, bounds, and alias rejection.
  it({ name: 'retains nested ordinary and null-prototype objects and freezes every container', fn: async function freezeContainers() {
    const nullPrototype: object = Object.create(null);
    const inner = { value: undefined };
    const list = [inner, nullPrototype];
    const root = { list };
    assert.equal(seal(root), root);
    for (const value of [root, list, inner, nullPrototype]) assert.ok(Object.isFrozen(value));
    assert.equal(Object.getPrototypeOf(nullPrototype), null);
    assert.equal(seal(root), root);
  } }),
  it({ name: 'rejects repeated objects and cycles even when already frozen', fn: async function rejectAliases() {
    const shared = Object.freeze({});
    const cycle: { self?: object } = {};
    cycle.self = cycle;
    for (const input of [[shared, shared], { first: shared, last: shared }, Object.freeze(cycle)]) {
      assert.throws(function repeatedObject() { seal(input); }, { message: 'Prepared input must be a non-aliased JSON-like tree' });
    }
  } }),
  it({ name: 'rejects unsupported object and array prototypes', fn: async function rejectPrototypes() {
    const foreign: object = Object.create({ inherited: true });
    const array: unknown[] = [];
    Object.setPrototypeOf(array, null);
    for (const input of [new Date(0), new Uint8Array(0), foreign, array]) {
      assert.throws(function unsupportedPrototype() { seal(input); }, { message: 'Prepared input has an unsupported prototype' });
      assert.equal(Object.isFrozen(input), false);
    }
  } }),
  it({ name: 'counts containers with an inclusive bound and no recursive traversal', fn: async function treeBound() {
    const accepted = Array.from({ length: 9_999 }, function container() { return {}; });
    assert.equal(seal(accepted), accepted);
    assert.ok(accepted.every(Object.isFrozen));
    const rejected = Array.from({ length: 10_000 }, function container() { return {}; });
    assert.throws(function beyondBound() { seal(rejected); }, { message: 'Prepared input exceeds the declared tree bound' });
    assert.ok(Object.isFrozen(rejected));
    assert.equal(Object.isFrozen(rejected[0]), false);
    assert.ok(Object.isFrozen(rejected[1]));
    const primitives = Array.from({ length: 10_001 }, function primitive() { return undefined; });
    assert.equal(seal(primitives), primitives);
  } }),
  it({ name: 'freezes parents and last children before failing the first child', fn: async function partialFreeze() {
    const invalid = { value: Symbol('invalid') };
    const valid = { nested: {} };
    const root = { invalid, valid };
    assert.throws(function partialTraversal() { seal(root); }, PreparedBatchContractError);
    for (const value of [root, invalid, valid, valid.nested]) assert.ok(Object.isFrozen(value));
    const untouched = {};
    const secondRoot = { untouched, invalid: Symbol('stop') };
    assert.throws(function stopsAtLast() { seal(secondRoot); }, PreparedBatchContractError);
    assert.ok(Object.isFrozen(secondRoot));
    assert.equal(Object.isFrozen(untouched), false);
  } }),
  //endregion
] });
