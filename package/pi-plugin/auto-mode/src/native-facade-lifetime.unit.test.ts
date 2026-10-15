/** Built original dependency checks retain live deadline and completed-clock cancellation boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFacadeFixture, finalizationEvents } from './native-facade-fixture.ts';

//region Retained checks never reuse an expired decision clock but still enforce original cancellation.
await describe({ name: '', children: [
  it({ name: 'keeps retained dependency checks after live expiry and rejects original cancellation', fn: async function retainedLifetime() {
    /** Original handle is prepared while the fixed deadline remains live. */
    const f = createFacadeFixture();
    /** Issuing ownership remains fixed after deadline failure. */
    const owner = f.construct();
    /** Completed original observations stay available for retained checking. */
    const handle = owner.prepare({ signal: f.controller.signal });
    f.state.now = 200;
    assert.throws(function expired() { owner.finalize(handle); }, { name: 'DependencyDeadlineError' });
    assert.throws(function expiredFile() { owner.originalFile({ handle, absolutePath: '/undeclared' }); }, { name: 'DependencyDeadlineError' });
    f.state.fail = 'clock';
    f.events.length = 0;
    assert.equal(owner.checkRetained(handle).decisionDeadlineChecked, false);
    assert.deepEqual(f.events, finalizationEvents.filter(function withoutClock(point) { return point !== 'clock'; }));
    f.controller.abort(f.failure);
    f.events.length = 0;
    assert.throws(function cancelled() { owner.checkRetained(handle); }, { name: 'DependencyCancellationError' });
    assert.deepEqual(f.events, ['finalize.handle-check', 'finalize.handle-owned', 'finalize.entry']);
  } }),
  ...['prepare.root.return', 'prepare.collector.return', 'prepare.success'].map(function preparationBoundary(point) {
    return describe({ name: point, children: ['cancelled', 'expired'].map(function changedLifetime(mode) {
      return it({ name: `rechecks original ${mode} lifetime before returning preparation`, fn: async function preparationCheckpoint() {
        /** The selected callback changes only the current original lifetime. */
        const f = createFacadeFixture();
        f.state.onStep = function changeLifetime(current): void {
          if (current !== point) return;
          if (mode === 'cancelled') f.controller.abort(f.failure);
          else f.state.now = 200;
        };
        /** Final preparation observation must complete before the caller receives a handle. */
        const owner = f.construct();
        assert.throws(function changed() { owner.prepare({ signal: f.controller.signal }); }, {
          name: mode === 'cancelled' ? 'DependencyCancellationError' : 'DependencyDeadlineError',
        });
        assert.equal(f.events.at(-1), mode === 'cancelled' ? point : 'clock');
      } });
    }) });
  }),
  ...['finalize.root.return', 'finalize.collector.return', 'finalize.success'].map(function retainedBoundary(point) {
    return describe({ name: point, children: ['finalize', 'checkRetained'].map(function originalMode(mode) {
      return it({ name: `rechecks cancellation during ${mode}`, fn: async function revalidationCheckpoint() {
        /** Preparation finishes before original cancellation is attached to a later callback. */
        const f = createFacadeFixture();
        /** Original owner retains the same signal across every revalidation boundary. */
        const owner = f.construct();
        /** Only the original issued handle can enter these retained callbacks. */
        const handle = owner.prepare({ signal: f.controller.signal });
        f.state.onStep = function cancel(current): void {
          if (current === point) f.controller.abort(f.failure);
        };
        f.events.length = 0;
        assert.throws(function changed() {
          if (mode === 'finalize') owner.finalize(handle);
          else owner.checkRetained(handle);
        }, { name: 'DependencyCancellationError' });
        assert.equal(f.events.at(-1), point);
      } });
    }) });
  }),
  it({ name: 'uses the original native clock default when the optional callback is absent', fn: async function nativeClock() {
    /** Empty declared file profile keeps the default-clock check independent of filesystem timing. */
    const f = createFacadeFixture();
    delete f.options.now;
    f.options.deadlineAt = Number.MAX_VALUE;
    /** No fixture clock callback is available to this original owner. */
    const owner = f.construct();
    /** Original default clock permits preparation and live finalization. */
    const handle = owner.prepare({ signal: f.controller.signal });
    assert.equal(owner.finalize(handle).decisionDeadlineChecked, true);
    assert.equal(f.events.includes('clock'), false);
  } }),
] });
//endregion
