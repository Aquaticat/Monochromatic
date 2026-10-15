/**
 Built native member lifecycle consumers verify callback order and queue ownership. @module
 */
import assert from 'node:assert/strict';
import { setImmediate as immediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifecycleFixture } from './native-prepared-lifecycle-fixture.ts';

await describe({ name: 'original prepared native lifecycle', children: [
  //region Original native callbacks and borrowed values retain identity and ordering.
  it({ name: 'forwards original native arguments and releases preparation before finishing', fn: async function original() {
    const fixture = createLifecycleFixture();
    fixture.control.start = function start(call) { 
      assert.equal(call, fixture.call); 
    };
    fixture.control.finish = function finish(result) { 
      assert.equal(result, fixture.result); 
    };
    fixture.control.native = async function native(call, options) {
      assert.equal(call, fixture.call);
      assert.equal(options.tools, fixture.identities.executableTools);
      assert.equal(options.assistantMessage, fixture.identities.assistantMessage);
      assert.equal(options.context, fixture.identities.context);
      assert.equal(options.signal, fixture.identities.signal);
      assert.equal(options.afterToolCall, fixture.identities.after);
      assert.equal(options.onUpdate, undefined);
      assert.equal(Object.hasOwn(options, 'onUpdate'), true);
      assert.equal(Object.isFrozen(options), false);
      await options.beforeToolCall(fixture.hook);
      return fixture.result;
    };
    assert.equal(await fixture.run(), fixture.result);
    assert.deepEqual(fixture.events, ['wait:3', 'start', 'native', 'prepare', 'release-preparation:3', 'finish', 'release-execution:3']);
    const preparation = fixture.preparations.at(0);
    assert.ok(preparation);
    assert.equal(preparation.hook, fixture.hook);
    assert.equal(preparation.call, fixture.call);
    assert.deepEqual(preparation.memberState, { entered: true, preparationReleased: true });
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.blockReasons, []);
  } }),
  ...['wait', 'start', 'native', 'finish'].map(function gateCase(boundary) {
    return it({ name: `awaits original ${boundary} completion before advancing`, fn: async function waitBoundary() {
      const fixture = createLifecycleFixture();
      const gate = Promise.withResolvers<unknown>();
      const settled = { value: false };
      function pending(): Promise<unknown> { 
        return gate.promise; 
      }
      if (boundary === 'wait') fixture.control.wait = pending;
      if (boundary === 'start') fixture.control.start = pending;
      if (boundary === 'finish') fixture.control.finish = pending;
      if (boundary === 'native') fixture.control.native = pending;
      async function observe(): Promise<unknown> { 
        const result = await fixture.run();
      settled.value = true;
      return result; 
      }
      const running = observe();
      await immediate();
      const observed = [...fixture.events];
      const premature = settled.value;
      gate.resolve(fixture.result);
      assert.equal(await running, fixture.result);
      assert.equal(premature, false);
      const expected: Readonly<Record<string, readonly string[]>> = {
        wait: ['wait:3'],
        start: ['wait:3', 'start'],
        native: ['wait:3', 'start', 'native'],
        finish: ['wait:3', 'start', 'native', 'prepare', 'release-preparation:3', 'finish'],
      };
      assert.deepEqual(observed, expected[boundary]);
      assert.equal(fixture.events.at(-1), 'release-execution:3');
    } });
  }),
  ...[undefined, null].map(function optionalCase(absent, ordinal) {
    return it({ name: `retains absent original start and finish notifications ${ordinal}`, fn: async function optional() {
      const fixture = createLifecycleFixture();
      assert.equal(await fixture.run({ onStart: absent, onFinish: absent }), fixture.result);
      assert.deepEqual(fixture.events, ['wait:3', 'native', 'prepare', 'release-preparation:3', 'release-execution:3']);
    } });
  }),
  it({ name: 'blocks missing native preparation while retaining result and finish callback', fn: async function noPreparation() {
    const fixture = createLifecycleFixture();
    fixture.control.native = function noHook() { 
      return fixture.result; 
    };
    assert.equal(await fixture.run(), fixture.result);
    assert.deepEqual(fixture.blockReasons, ['A member failed native preparation before group admission']);
    assert.deepEqual(fixture.events, ['wait:3', 'start', 'native', 'block', 'finish', 'release-preparation:3', 'release-execution:3']);
    assert.deepEqual(fixture.failures, []);
  } }),
  it({ name: 'releases the original ordinal zero without treating it as absent', fn: async function first() {
    const fixture = createLifecycleFixture();
    assert.equal(await fixture.run({ ordinalByID: new Map([['one', 0]]) }), fixture.result);
    assert.deepEqual(fixture.events, ['wait:0', 'start', 'native', 'prepare', 'release-preparation:0', 'finish', 'release-execution:0']);
  } }),
  //endregion
] });
