/** Built dependency facade preserves original ownership, projection identity, and ordered failures. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFacadeFixture, preparationEvents, finalizationEvents } from './native-facade-fixture.ts';

//region Original records retain exact callback identities and expose mechanical evidence only.
await describe({ name: '', children: [
  it({ name: 'prepares original observations and retains live versus completed-clock projections', fn: async function projections() {
    /** Deferred construction performs no external observations. */
    const f = createFacadeFixture();
    /** Original owner stays frozen independently of every issued handle. */
    const owner = f.construct();
    assert.equal(Object.isFrozen(owner), true);
    assert.deepEqual(Reflect.ownKeys(owner), ['prepare', 'finalize', 'checkRetained', 'originalFile']);
    assert.deepEqual(f.events, []);
    /** Preparation retains the original root and source identities behind an opaque handle. */
    const handle = owner.prepare({ signal: f.controller.signal });
    assert.equal(Object.isFrozen(handle), true);
    assert.deepEqual(Reflect.ownKeys(handle), []);
    assert.deepEqual(f.events, preparationEvents);
    f.events.length = 0;
    /** Live projection remains explicitly mechanical and retains unqualified coverage identity. */
    const live = owner.finalize(handle);
    assert.deepEqual(f.events, finalizationEvents);
    assert.deepEqual(live, {
      mechanicalDependenciesCurrent: true, decisionDeadlineChecked: true, unqualifiedCoverage: f.coverage,
      instructionAuthority: 'not-established', humanWitness: 'not-established',
      currentEligibilityEstablished: false, productionPermission: false, actualSDKRootAdapterQualified: false,
    });
    assert.equal(live.unqualifiedCoverage, f.coverage);
    assert.equal(Object.isFrozen(live), true);
    f.events.length = 0;
    /** Retained checks preserve dependency work while omitting every model-clock read. */
    const retained = owner.checkRetained(handle);
    assert.deepEqual(f.events, finalizationEvents.filter(function withoutClock(point) { 
      return point !== 'clock'; 
    }));
    assert.deepEqual(retained, { ...live, decisionDeadlineChecked: false });
    assert.equal(retained.unqualifiedCoverage, f.coverage);
    assert.equal(Object.isFrozen(retained), true);
    assert.notEqual(retained, live);
    f.events.length = 0;
    assert.deepEqual(owner.originalFile({ handle, absolutePath: '/undeclared' }), { kind: 'undeclared-file' });
    assert.deepEqual(f.events, ['clock']);
    /** Repeated preparations publish separate original occurrence handles. */
    const another = owner.prepare({ signal: f.controller.signal });
    assert.notEqual(another, handle);
    /** A different issuing facade cannot claim the original handle. */
    const foreign = f.construct();
    assert.throws(function foreignHandle() { 
      foreign.finalize(handle); 
    }, { name: 'DependencyHandleOwnershipError' });
  } }),
  ...[...new Set(preparationEvents)].map(function failedPreparation(point) {
    return it({ name: `retains preparation failure at ${point} before later observations`, fn: async function preparationFailure() {
      /** Each selected original callback can fail without exposing an incomplete handle. */
      const f = createFacadeFixture();
      /** Recovery uses the same issuing facade and original capabilities. */
      const owner = f.construct();
      f.state.fail = point;
      assert.throws(function fail() { 
        owner.prepare({ signal: f.controller.signal }); 
      }, function same(error: unknown) { 
        return error === f.failure; 
      });
      assert.deepEqual(f.events, preparationEvents.slice(0, preparationEvents.indexOf(point) + 1));
      delete f.state.fail;
      f.events.length = 0;
      owner.prepare({ signal: f.controller.signal });
      assert.deepEqual(f.events, preparationEvents);
    } });
  }),
  ...['finalize', 'checkRetained'].map(function revalidationMode(mode) {
    /** Retained-only mode has the same dependency boundaries without clock events. */
    const expected = mode === 'finalize' ? finalizationEvents : finalizationEvents.filter(function withoutClock(point) { 
      return point !== 'clock'; 
    });
    return describe({ name: mode, children: [...new Set(expected)].map(function failedRevalidation(point) {
      return it({ name: `retains ${point} failure and permits original recovery`, fn: async function retainedFailure() {
        /** Original preparation succeeds before a revalidation callback is made to fail. */
        const f = createFacadeFixture();
        /** The original issuing facade and its handle remain fixed during fault recovery. */
        const owner = f.construct();
        /** Original record is available to both live and retained checks. */
        const handle = owner.prepare({ signal: f.controller.signal });
        f.events.length = 0;
        f.state.fail = point;
        assert.throws(function fail() {
          if (mode === 'finalize') owner.finalize(handle);
          else owner.checkRetained(handle);
        }, function same(error: unknown) { 
          return error === f.failure; 
        });
        assert.deepEqual(f.events, expected.slice(0, expected.indexOf(point) + 1));
        delete f.state.fail;
        f.events.length = 0;
        if (mode === 'finalize') owner.finalize(handle);
        else owner.checkRetained(handle);
        assert.deepEqual(f.events, expected);
      } });
    }) });
  }),
  ...[{}, function foreignFunction() {}, undefined, null, false, 0, 0n, 'foreign', Symbol('unregistered dependency handle never issued'), Symbol.for('registered dependency handle never issued')].map(function foreignCase(handle, ordinal) {
    return it({ name: `rejects foreign dependency handle ${String(ordinal)} before live work`, fn: async function foreign() {
      /** Already-cancelled state must not supersede foreign ownership failure. */
      const f = createFacadeFixture();
      /** Ownership is checked before cancellation or any external callback. */
      const owner = f.construct();
      f.controller.abort(f.failure);
      assert.throws(function finalizeForeign() { 
        owner.finalize(handle); 
      }, { name: 'DependencyHandleOwnershipError' });
      assert.deepEqual(f.events, ['finalize.handle-check']);
      f.events.length = 0;
      assert.throws(function retainedForeign() { 
        owner.checkRetained(handle); 
      }, { name: 'DependencyHandleOwnershipError' });
      assert.deepEqual(f.events, ['finalize.handle-check']);
      f.events.length = 0;
      assert.throws(function originalForeign() { 
        owner.originalFile({ handle, absolutePath: '/foreign' }); 
      }, { name: 'DependencyHandleOwnershipError' });
      assert.deepEqual(f.events, []);
    } });
  }),
] });
//endregion
