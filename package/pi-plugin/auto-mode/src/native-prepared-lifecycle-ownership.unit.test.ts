/**
 Original native callbacks preserve synchronous values and retained preparation closure ownership. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifecycleFixture } from './native-prepared-lifecycle-fixture.ts';

await describe({ name: 'original native callback ownership', children: [
  //region Borrowed callbacks expose original values without wrapping or awaiting them.
  it({ name: 'returns exact synchronous preparation and update values', fn: async function forwarding() {
    const fixture = createLifecycleFixture();
    const prepared = { original: 'preparation' };
    const partial = { original: 'partial' };
    const updated = { original: 'update' };
    fixture.control.prepare = function prepare(input) { input.memberState.entered = true;
    return prepared; };
    fixture.control.native = function native(_call, options) {
      assert.equal(options.beforeToolCall(fixture.hook), prepared);
      assert.ok(options.onUpdate);
      assert.equal(options.onUpdate(partial), updated);
      return fixture.result;
    };
    assert.equal(await fixture.run({ onUpdate(input: unknown, call: unknown) { assert.equal(input, partial);
    assert.equal(call, fixture.call);
    return updated; } }), fixture.result);
    assert.deepEqual(fixture.events, ['wait:3', 'start', 'native', 'prepare', 'finish', 'release-preparation:3', 'release-execution:3']);
  } }),
  it({ name: 'preserves update failure identity inside original lifecycle catch', fn: async function updateFailure() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'update' };
    fixture.control.native = function native(_call, options) { assert.ok(options.onUpdate);
    return options.onUpdate({}); };
    await assert.rejects(fixture.run({ onUpdate() { throw failure; } }), function original(error: unknown) { assert.equal(error, failure);
    return true; });
    assert.deepEqual(fixture.failures, [failure]);
    assert.deepEqual(fixture.blockReasons, ['Native member lifecycle failed']);
  } }),
  it({ name: 'keeps malformed null update callable until native invocation', fn: async function nullUpdate() {
    const fixture = createLifecycleFixture();
    fixture.control.native = function native(_call, options) { assert.equal(typeof options.onUpdate, 'function');
    return fixture.result; };
    assert.equal(await fixture.run({ onUpdate: null }), fixture.result);
    const options = fixture.options.at(0);
    assert.ok(options?.onUpdate);
    assert.throws(function invoke() { options.onUpdate?.({}); }, TypeError);
  } }),
  it({ name: 'releases preparation once across repeated and retained native hooks', fn: async function retainedPreparation() {
    const fixture = createLifecycleFixture();
    fixture.control.prepare = function prepare(input) {
      assert.equal(input.memberState.entered, fixture.preparations.length > 1);
      input.memberState.entered = true;
      input.releasePreparation();
      assert.equal(input.memberState.preparationReleased, true);
      input.releasePreparation();
    };
    fixture.control.native = async function native(_call, options) {
      await options.beforeToolCall(fixture.hook);
      await options.beforeToolCall(fixture.hook);
      return fixture.result;
    };
    assert.equal(await fixture.run(), fixture.result);
    const options = fixture.options.at(0);
    assert.ok(options);
    await options.beforeToolCall(fixture.hook);
    assert.equal(fixture.preparations.length, 3);
    assert.equal(fixture.preparations[0]?.memberState, fixture.preparations[2]?.memberState);
    assert.equal(fixture.preparations[0]?.releasePreparation, fixture.preparations[2]?.releasePreparation);
    assert.equal(fixture.events.filter(function release(value) { return value === 'release-preparation:3'; }).length, 1);
    assert.equal(fixture.events.filter(function release(value) { return value === 'release-execution:3'; }).length, 1);
  } }),
  it({ name: 'ignores original release callback return values synchronously', fn: async function synchronousDisposal() {
    const fixture = createLifecycleFixture();
    const returned = new Proxy({}, { get(_target, key) {
      assert.notEqual(key, 'then', 'Original synchronous disposal must not read then');
      return undefined;
    } });
    fixture.control.releasePreparation = function release() { return returned; };
    fixture.control.releaseExecution = function release() { return returned; };
    assert.equal(await fixture.run(), fixture.result);
    assert.equal(fixture.events.at(-1), 'release-execution:3');
  } }),
  it({ name: 'retains native failure when failure storage throws before blocking', fn: async function storageFailure() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'native' };
    const storage: unknown = { original: 'storage' };
    fixture.control.native = function reject() { throw failure; };
    await assert.rejects(fixture.run({ failures: { push(input: unknown) { assert.equal(input, failure);
    throw storage; } } }), function original(error: unknown) { assert.equal(error, storage);
    return true; });
    assert.deepEqual(fixture.blockReasons, []);
    assert.equal(fixture.events.at(-1), 'release-execution:3');
  } }),
  //endregion
] });
