/**
 Original member lifecycle failure boundaries retain opaque causes and disposal ordering. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError } from './native-input-seal-fixture.ts';
import { createLifecycleFixture } from './native-prepared-lifecycle-fixture.ts';

await describe({ name: 'original native lifecycle failure ownership', children: [
  //region Ordinal failure precedes retained-failure and disposal ownership.
  it({ name: 'rejects missing ordinal before callbacks, blocking, or disposal', fn: async function missing() {
    const fixture = createLifecycleFixture();
    await assert.rejects(fixture.run({ ordinalByID: new Map() }), function original(error: unknown) {
      assert.ok(error instanceof PreparedBatchContractError);
      assert.equal(error.message, 'Preparation has no declared member ordinal');
      return true;
    });
    assert.deepEqual(fixture.events, []);
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.blockReasons, []);
  } }),
  it({ name: 'borrows original missing-ordinal constructor', fn: async function constructor() {
    const fixture = createLifecycleFixture();
    class OriginalContractError extends Error { override name = 'OriginalContractError'; }
    await assert.rejects(fixture.run({ ordinalByID: new Map(), PreparedBatchContractError: OriginalContractError }), OriginalContractError);
    assert.deepEqual(fixture.events, []);
  } }),
  it({ name: 'preserves ordinal lookup failure before disposal', fn: async function lookupFailure() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'lookup' };
    await assert.rejects(fixture.run({ ordinalByID: { get() { throw failure; } } }), function original(error: unknown) { assert.equal(error, failure); return true; });
    assert.deepEqual(fixture.events, []);
    assert.deepEqual(fixture.failures, []);
  } }),
  //endregion
  //region Fallible native callbacks retain original failures before blocking and disposal.
  ...['wait', 'start', 'native', 'prepare', 'finish'].flatMap(function boundaryCases(boundary) {
    return [undefined, null, { original: boundary }].map(function opaqueCase(failure, ordinal) {
      return it({ name: `retains opaque ${boundary} failure ${ordinal}`, fn: async function retained() {
        const fixture = createLifecycleFixture();
        const originalFailure: unknown = failure;
        async function reject(): Promise<never> { throw originalFailure; }
        if (boundary === 'wait') fixture.control.wait = reject;
        if (boundary === 'start') fixture.control.start = reject;
        if (boundary === 'native') fixture.control.native = reject;
        if (boundary === 'prepare') fixture.control.prepare = reject;
        if (boundary === 'finish') fixture.control.finish = reject;
        await assert.rejects(fixture.run(), function original(error: unknown) { assert.equal(error, failure); return true; });
        assert.deepEqual(fixture.failures, [failure]);
        assert.equal(fixture.failures[0], failure);
        assert.deepEqual(fixture.blockReasons, ['Native member lifecycle failed']);
        assert.equal(fixture.events.at(-1), 'release-execution:3');
        assert.equal(fixture.events.filter(function preparation(value) { return value === 'release-preparation:3'; }).length, 1);
      } });
    });
  }),
  ...['releasePreparation', 'releaseExecution'].map(function disposalCase(boundary) {
    return it({ name: `preserves ${boundary} failure outside lifecycle catch`, fn: async function disposal() {
      const fixture = createLifecycleFixture();
      const failure: unknown = { original: boundary };
      fixture.control.prepare = function retainTurn(input) { input.memberState.entered = true; };
      function reject(): never { throw failure; }
      if (boundary === 'releasePreparation') fixture.control.releasePreparation = reject;
      if (boundary === 'releaseExecution') fixture.control.releaseExecution = reject;
      await assert.rejects(fixture.run(), function original(error: unknown) { assert.equal(error, failure); return true; });
      assert.deepEqual(fixture.failures, []);
      assert.deepEqual(fixture.blockReasons, []);
      assert.equal(fixture.events.includes('finish'), true);
      assert.equal(fixture.events.includes('release-execution:3'), boundary === 'releaseExecution');
    } });
  }),
  it({ name: 'retains early preparation release failure once and still disposes execution', fn: async function earlyRelease() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'early release' };
    fixture.control.releasePreparation = function reject() { throw failure; };
    await assert.rejects(fixture.run(), function original(error: unknown) { assert.equal(error, failure); return true; });
    assert.deepEqual(fixture.failures, [failure]);
    assert.deepEqual(fixture.events, ['wait:3', 'start', 'native', 'prepare', 'release-preparation:3', 'block', 'release-execution:3']);
  } }),
  it({ name: 'preserves suppressed original callback failure when disposal also throws', fn: async function suppressed() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'native' };
    const disposal: unknown = { original: 'disposal' };
    fixture.control.native = function reject() { throw failure; };
    fixture.control.releaseExecution = function reject() { throw disposal; };
    await assert.rejects(fixture.run(), function original(error: unknown) {
      assert.ok(error instanceof SuppressedError);
      assert.equal(error.error, disposal);
      assert.equal(error.suppressed, failure);
      return true;
    });
    assert.deepEqual(fixture.failures, [failure]);
    assert.deepEqual(fixture.blockReasons, ['Native member lifecycle failed']);
    assert.deepEqual(fixture.events, ['wait:3', 'start', 'native', 'block', 'release-preparation:3', 'release-execution:3']);
  } }),
  it({ name: 'preserves blocking failure after retaining original callback failure', fn: async function blockFailure() {
    const fixture = createLifecycleFixture();
    const failure: unknown = { original: 'native' };
    const blocked: unknown = { original: 'block' };
    fixture.control.native = function reject() { throw failure; };
    await assert.rejects(fixture.run({ block() { throw blocked; } }), function original(error: unknown) { assert.equal(error, blocked); return true; });
    assert.deepEqual(fixture.failures, [failure]);
    assert.equal(fixture.events.at(-1), 'release-execution:3');
  } }),
  //endregion
] });
