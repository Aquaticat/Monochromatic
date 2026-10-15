/** Built original source handoff preserves callback order and request identity. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSourceFixture } from './native-source-fixture.ts';

//region Native handoff takes precedence over legacy observation and authenticates after source lookup.
await describe({ name: '', children: [
  it({ name: 'prefers native handoff with original receiver and response before request authentication', fn: async function nativeHandoff() {
    /** Construction consumes no freshness or dependency callbacks. */
    const f = createSourceFixture();
    assert.deepEqual(f.events, []);
    /** Original observer sources win over receipt fallback. */
    const owner = f.construct();
    assert.equal(owner.receipt, f.receipt);
    assert.equal(owner.readSourceSnapshot(), f.initial);
    assert.deepEqual(f.events, ['begin', 'request', 'bindingSources', 'bindingRequest']);
    assert.ok(Object.isFrozen(owner.collector));
    assert.deepEqual(Object.keys(owner.collector), ['capture', 'assertObservedFresh']);
  } }),
  ...[undefined, false, null].map(function legacyMarker(marker) {
    return it({ name: `retains legacy handoff when native callback is ${String(marker)}`, fn: async function legacyHandoff() {
      /** Existing falsy capability markers select the legacy method. */
      const f = createSourceFixture();
      f.observer.beginJudgmentSources = marker;
      assert.equal(f.construct().readSourceSnapshot(), f.initial);
      assert.deepEqual(f.events, ['bind', 'request', 'bindingSources', 'bindingRequest']);
    } });
  }),
  it({ name: 'falls back to original receipt when neither handoff callback exists', fn: async function receiptFallback() {
    /** Callback absence does not invent a binding request observation. */
    const f = createSourceFixture();
    delete f.observer.beginJudgmentSources;
    delete f.observer.bindJudgmentSources;
    assert.equal(f.construct().readSourceSnapshot(), f.fallback);
    assert.deepEqual(f.events, ['request', 'receiptSources']);
  } }),
  ...[undefined, null].map(function nullishResult(value) {
    return it({ name: `retains receipt fallback for ${String(value)} handoff results and sources`, fn: async function nullishFallback() {
      /** Absent binding has no request identity to authenticate. */
      const absent = createSourceFixture();
      absent.state.bindingResult = value;
      assert.equal(absent.construct().readSourceSnapshot(), absent.fallback);
      assert.deepEqual(absent.events, ['begin', 'request', 'receiptSources']);
      /** Existing binding still authenticates its request after fallback access. */
      const bound = createSourceFixture();
      bound.state.bindingSources = value;
      assert.equal(bound.construct().readSourceSnapshot(), bound.fallback);
      assert.deepEqual(bound.events, ['begin', 'request', 'bindingSources', 'receiptSources', 'bindingRequest']);
    } });
  }),
  it({ name: 'rejects a foreign binding request after source observation and before live callbacks', fn: async function foreignRequest() {
    /** Equal structure never substitutes for original request identity. */
    const f = createSourceFixture();
    f.state.bindingRequest = Object.freeze({});
    assert.throws(f.construct, { name: 'JudgmentConstructionError', message: 'Judgment sources do not belong to the original request receipt' });
    assert.deepEqual(f.events, ['begin', 'request', 'bindingSources', 'bindingRequest']);
  } }),
  ...['begin', 'bind', 'request', 'bindingSources', 'receiptSources', 'bindingRequest'].map(function callbackFailure(point) {
    return it({ name: `propagates original ${point} failure and stops later observations`, fn: async function originalFailure() {
      /** Each fault is injected before construction at its externally supplied boundary. */
      const f = createSourceFixture();
      /** Error identity must survive source handoff unchanged. */
      const failure = new Error(`original ${point} failure`);
      f.state.failures.set(point, failure);
      if (point === 'bind') delete f.observer.beginJudgmentSources;
      if (point === 'receiptSources') f.state.bindingSources = undefined;
      assert.throws(f.construct, function same(error: unknown) { return error === failure; });
      /** Expected prefix is independent of the implementation's callback sequence. */
      const expected = point === 'bind' ? ['bind'] : ['begin', 'request', 'bindingSources', ...(point === 'receiptSources' ? ['receiptSources'] : ['bindingRequest'])];
      assert.deepEqual(f.events, expected.slice(0, expected.indexOf(point) + 1));
    } });
  }),
] });
//endregion
