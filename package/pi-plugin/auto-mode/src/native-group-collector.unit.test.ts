/** Built collector construction retains original capabilities and complete source association. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { collectorFixtureModule, createCollectorFixture } from './native-group-collector-fixture.ts';

await describe({ name: '', children: [
  //region Construction validates original parent capabilities before reading the canonical group.
  ...['signal', 'assertParentCurrent', 'dispatchGroup', 'readGroup'].map(function missingCapability(key) {
    return it({ name: `rejects missing ${key} before original group read`, fn: async () => {
      const fixture = createCollectorFixture();
      assert.throws(function constructWithoutCapability() {
        collectorFixtureModule.createReachedGroupRun({ ...fixture.input, [key]: undefined });
      }, { message: 'Original parent cancellation and group consumer are required' });
      assert.deepEqual(fixture.events, ['read']);
    } });
  }),
  ...['mutable-view', 'foreign-handle', 'mutable-members'].map(function changedView(change) {
    return it({ name: `rejects original view with ${change}`, fn: async () => {
      const fixture = createCollectorFixture();
      const replacement = { ...fixture.view, ...(change === 'foreign-handle' ? { handle: {} } : {}), ...(change === 'mutable-members' ? { members: [...fixture.view.members] } : {}) };
      if (change !== 'mutable-view') Object.freeze(replacement);
      assert.throws(function constructWithView() {
        collectorFixtureModule.createReachedGroupRun({ ...fixture.input, readGroup() { 
          return replacement; 
        } });
      }, { message: 'Canonical reached group view is required' });
    } });
  }),
  it({ name: 'freezes original publication and retains declaration and alias identity', fn: async () => {
    const fixture = createCollectorFixture();
    assert.equal(Object.isFrozen(fixture.run), true);
    assert.equal(Object.isFrozen(fixture.run.declaration), true);
    assert.equal(Object.isFrozen(fixture.run.tools), true);
    assert.equal(fixture.run.declaration.source, fixture.view.declaration.source);
    assert.equal(fixture.run.declaration.members, fixture.view.members);
    for (const [index, tool] of fixture.run.tools.entries()) {
      assert.equal(Object.isFrozen(tool), true);
      assert.equal(tool.name, fixture.view.members[index]?.alias);
    }
    const snapshot = fixture.run.inspect();
    assert.equal(snapshot.phase, 'collecting');
    assert.equal(snapshot.failed, false);
    assert.equal(snapshot.dispatches, 0);
    assert.deepEqual(snapshot.members.map(function memberState(member) { 
      return [member.arrival, member.state, member.completion]; 
    }), [
      ['unarrived', 'unarrived', undefined], ['unarrived', 'unarrived', undefined],
    ]);
    await fixture.run.drain();
  } }),
  it({ name: 'installs the original parent listener once and detaches it at retirement', fn: async () => {
    const fixture = createCollectorFixture({ memberCount: 0 });
    const controller = new AbortController();
    const addListener = controller.signal.addEventListener.bind(controller.signal);
    const removeListener = controller.signal.removeEventListener.bind(controller.signal);
    const installed: EventListener[] = [];
    const removed: EventListener[] = [];
    Object.defineProperty(controller.signal, 'addEventListener', { value(type: string, listener: EventListener, options: AddEventListenerOptions): void {
      assert.equal(type, 'abort');
      assert.deepEqual(options, { once: true });
      installed.push(listener);
      addListener(type, listener, options);
    } });
    Object.defineProperty(controller.signal, 'removeEventListener', { value(type: string, listener: EventListener): void {
      assert.equal(type, 'abort');
      removed.push(listener);
      removeListener(type, listener);
    } });
    const run = collectorFixtureModule.createReachedGroupRun({ ...fixture.input, signal: controller.signal });
    assert.equal(installed.length, 1);
    run.retire();
    assert.deepEqual(removed, installed);
    await run.drain();
  } }),
  it({ name: 'collects out-of-order arrival once while retaining original declaration order', fn: async () => {
    const fixture = createCollectorFixture();
    const second = fixture.invoke({ index: 1 });
    assert.equal(fixture.calls.length, 0);
    assert.deepEqual(fixture.run.inspect().members.map(function arrival(member) { 
      return member.arrival; 
    }), ['unarrived', 'matched']);
    const first = fixture.invoke();
    assert.equal(fixture.calls.length, 1);
    const [call] = fixture.calls;
    assert.ok(call);
    assert.equal(call.handle, fixture.group);
    assert.equal(call.declaration, fixture.run.declaration);
    assert.deepEqual(call.members.map(function declaration(member) { 
      return member.declaration; 
    }), fixture.view.members);
    const handles = call.members.map(function handle(member) { 
      return member.handle; 
    });
    assert.equal(new Set(handles).size, 2);
    for (const handle of handles) assert.equal(Object.isFrozen(handle), true);
    const outcomes = [{ original: 'first' }, { original: 'second' }];
    for (const [index, completion] of fixture.completions.entries()) completion.resolve(outcomes[index]);
    assert.deepEqual(await Promise.all([first, second]), outcomes);
    await fixture.run.drain();
    const snapshot = fixture.run.inspect();
    assert.equal(snapshot.phase, 'settled');
    assert.equal(snapshot.dispatches, 1);
    assert.equal(snapshot.failed, false);
    assert.deepEqual(snapshot.members.map(function retained(member) { 
      return member.completion; 
    }), outcomes.map(function fulfilled(value) { 
      return { status: 'fulfilled', value }; 
    }));
  } }),
  ...[undefined, null, 'opaque', Object.freeze({ original: 'native rejection' })].map(function rejectedOutcome(reason) {
    return it({ name: `retains native rejection ${JSON.stringify(reason)} independently of collection failure`, fn: async () => {
      const fixture = createCollectorFixture({ memberCount: 1 });
      const pending = fixture.invoke();
      const settled = Promise.allSettled([pending]);
      const [completion] = fixture.completions;
      assert.ok(completion);
      completion.reject(reason);
      assert.deepEqual(await settled, [{ status: 'rejected', reason }]);
      await fixture.run.drain();
      const snapshot = fixture.run.inspect();
      assert.equal(snapshot.phase, 'settled');
      assert.equal(snapshot.failed, false);
      assert.deepEqual(snapshot.members[0]?.completion, { status: 'rejected', reason });
    } });
  }),
  it({ name: 'observes pre-existing parent cancellation before native callback publication', fn: async () => {
    const fixture = createCollectorFixture({ startAborted: true });
    const before = fixture.run.inspect();
    assert.equal(before.failed, true);
    assert.equal(before.failure, 'original pre-construction cancellation');
    const [result] = await Promise.allSettled([fixture.invoke()]);
    assert.deepEqual(result, { status: 'rejected', reason: before.failure });
    assert.equal(fixture.calls.length, 0);
  } }),
  it({ name: 'preserves empty declaration publication without inventing dispatch or cancellation failure', fn: async () => {
    const fixture = createCollectorFixture({ memberCount: 0, startAborted: true });
    assert.deepEqual(fixture.run.tools, []);
    assert.equal(fixture.run.inspect().failed, false);
    assert.equal(fixture.calls.length, 0);
    await fixture.run.drain();
    fixture.run.retire();
    assert.equal(fixture.run.inspect().phase, 'closed');
  } }),
  //endregion
] });
