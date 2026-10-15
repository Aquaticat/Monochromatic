/** Built source collection preserves publication, signal identity, and observation boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSourceFixture } from './native-source-fixture.ts';

//region Publication remains inert while current binding and collection capture retain distinct checks.
await describe({ name: '', children: [
  it({ name: 'publishes original identities without freshness checks and reads current frozen bindings', fn: async function publication() {
    /** Source snapshots remain inert even if all live observations fail. */
    const f = createSourceFixture();
    /** Built owner shares its current collection across all consumers. */
    const owner = f.construct();
    f.events.length = 0;
    owner.publishJudgmentSources(f.published);
    assert.equal(owner.readSourceSnapshot(), f.published);
    assert.deepEqual(f.events, []);
    /** Binding view observes dependencies before copying current identities. */
    const binding = owner.readCurrentSourceBinding();
    assert.deepEqual(Object.keys(binding), ['request', 'sources']);
    assert.ok(Object.isFrozen(binding));
    assert.equal(binding.request, f.receipt);
    assert.equal(binding.sources, f.published);
    assert.deepEqual(f.events, ['dependencies']);
    owner.publishJudgmentSources(f.initial);
    assert.equal(binding.sources, f.published);
    assert.equal(owner.readSourceSnapshot(), f.initial);
  } }),
  it({ name: 'requires exact original cancellation identity before freshness and leaves cancellation to observer', fn: async function signalIdentity() {
    /** An equal-state foreign signal cannot capture original sources. */
    const f = createSourceFixture();
    /** Original signal remains the same capability after cancellation. */
    const owner = f.construct();
    f.events.length = 0;
    assert.throws(function foreignSignal() { owner.collector.capture({ signal: new AbortController().signal }); }, { name: 'JudgmentConstructionError', message: 'Dependency sources require original judgment cancellation' });
    assert.deepEqual(f.events, []);
    assert.equal(owner.collector.capture({ signal: f.controller.signal }), f.initial);
    f.controller.abort(new Error('original cancellation'));
    assert.equal(owner.collector.capture({ signal: f.controller.signal }), f.initial);
    assert.deepEqual(f.events, ['freshness', 'freshness']);
    assert.deepEqual(f.observed, [f.initial, f.initial]);
  } }),
  it({ name: 'rejects stale and equal-looking snapshots before invoking freshness', fn: async function collectionIdentity() {
    /** Publishing a replacement retires the previous collection identity. */
    const f = createSourceFixture();
    /** Collector and publisher share the current reference. */
    const owner = f.construct();
    owner.publishJudgmentSources(f.published);
    f.events.length = 0;
    for (const snapshot of [f.initial, Object.freeze({})]) {
      assert.throws(function staleSnapshot() { owner.collector.assertObservedFresh(snapshot); }, { name: 'JudgmentConstructionError', message: 'Dependencies require the original assessed source collection' });
    }
    assert.deepEqual(f.events, []);
    owner.collector.assertObservedFresh(f.published);
    assert.equal(f.observed[0], f.published);
    assert.deepEqual(f.events, ['freshness']);
  } }),
  ...['capture', 'assert', 'binding'].map(function publicationBoundary(operation) {
    return it({ name: `retains publication during ${operation} observation`, fn: async function reentrantPublication() {
      /** External callbacks can publish without changing original observation inputs. */
      const f = createSourceFixture();
      /** Current collection must be read at each original statement boundary. */
      const owner = f.construct();
      f.events.length = 0;
      f.state.onStep = function publish() { owner.publishJudgmentSources(f.published); };
      if (operation === 'binding') {
        assert.equal(owner.readCurrentSourceBinding().sources, f.published);
        assert.deepEqual(f.events, ['dependencies']);
        assert.deepEqual(f.observed, []);
      } else {
        if (operation === 'capture') assert.equal(owner.collector.capture({ signal: f.controller.signal }), f.published);
        else owner.collector.assertObservedFresh(f.initial);
        assert.deepEqual(f.events, ['freshness']);
        assert.equal(f.observed[0], f.initial);
      }
      assert.equal(owner.readSourceSnapshot(), f.published);
    } });
  }),
  ...['capture', 'assert', 'binding'].map(function failingObservation(operation) {
    return it({ name: `propagates original ${operation} callback failure while keeping inert snapshot reads`, fn: async function observerFailure() {
      /** Original callback failures are not wrapped or retained as source-owner state. */
      const f = createSourceFixture();
      /** Built owner preserves the original published collection after failed observation. */
      const owner = f.construct();
      /** Fault identity is independently observed at the consumer. */
      const failure = new Error(`original ${operation} failure`);
      f.state.failures.set(operation === 'binding' ? 'dependencies' : 'freshness', failure);
      f.events.length = 0;
      assert.throws(function failedRead() {
        if (operation === 'binding') owner.readCurrentSourceBinding();
        else if (operation === 'capture') owner.collector.capture({ signal: f.controller.signal });
        else owner.collector.assertObservedFresh(f.initial);
      }, function same(error: unknown) { return error === failure; });
      assert.deepEqual(f.events, [operation === 'binding' ? 'dependencies' : 'freshness']);
      f.events.length = 0;
      owner.publishJudgmentSources(f.published);
      assert.equal(owner.readSourceSnapshot(), f.published);
      assert.deepEqual(f.events, []);
      f.state.failures.clear();
      assert.equal(owner.readCurrentSourceBinding().sources, f.published);
      assert.equal(owner.collector.capture({ signal: f.controller.signal }), f.published);
    } });
  }),
] });
//endregion
