/** Original program runtime publishes owned tools and lazily reaches canonical source groups. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult } from './native-group-collector-fixture.ts';
import { createProgramRuntimeFixture } from './native-program-runtime-fixture.ts';

await describe({ name: '', children: [
  //region Original construction and lazy group association preserve source and tool identity.
  it({ name: 'publishes frozen original source tools without reaching or dispatching a group', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    assert.deepEqual(fixture.events, ['program']);
    assert.equal(fixture.run.declaration, fixture.declaration);
    assert.equal(Object.isFrozen(fixture.run), true);
    assert.equal(Object.isFrozen(fixture.run.tools), true);
    assert.deepEqual(fixture.run.tools.map(function alias(tool) { return tool.name; }), fixture.declaration.sites.map(function alias(site) { return site.alias; }));
    for (const tool of fixture.run.tools) assert.equal(Object.isFrozen(tool), true);
    const snapshot = fixture.run.inspect();
    assert.deepEqual(snapshot, { retainedOnly: true, closed: false, reachedGroups: [] });
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.reachedGroups), true);
    assert.deepEqual(fixture.events, ['program']);
    assert.deepEqual(fixture.calls, []);
    await awaitCollectorResult(fixture.run.drain());
    assert.deepEqual(fixture.events, ['program', 'inspect-program']);
  } }),
  it({ name: 'reuses reached groups while retaining source member order and actual reach order', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const later = fixture.invoke(2);
    const second = fixture.invoke(1);
    assert.deepEqual(fixture.run.inspect().reachedGroups.map(function ordinal(group) { return group.ordinal; }), [1, 0]);
    assert.equal(fixture.calls.length, 1);
    const first = fixture.invoke();
    assert.equal(fixture.calls.length, 2);
    assert.deepEqual(fixture.calls.map(function handle(call) { return call.handle; }), [fixture.views[1]?.handle, fixture.views[0]?.handle]);
    assert.equal(fixture.events.filter(function firstGroupRead(event) { return event === 'reach:0'; }).length, 2);
    const firstValue = Object.freeze({ original: 'first' });
    const secondValue = Object.freeze({ original: 'second' });
    const laterValue = Object.freeze({ original: 'later' });
    const [firstCompletion, secondCompletion] = fixture.completions();
    const [laterCompletion] = fixture.completions(1);
    assert.ok(firstCompletion);
    assert.ok(secondCompletion);
    assert.ok(laterCompletion);
    firstCompletion.resolve(firstValue);
    secondCompletion.resolve(secondValue);
    laterCompletion.resolve(laterValue);
    assert.deepEqual(await awaitCollectorResult(Promise.all([first, second, later])), [firstValue, secondValue, laterValue]);
    await awaitCollectorResult(fixture.run.drain());
    const snapshot = fixture.run.inspect();
    assert.equal(snapshot.reachedGroups.every(function settled(group) { return group.collector.phase === 'settled'; }), true);
    for (const group of snapshot.reachedGroups) assert.equal(Object.isFrozen(group), true);
    assert.deepEqual(fixture.marked, []);
  } }),
  it({ name: 'marks a changed canonical group before invoking another original member', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const pending = fixture.invoke();
    const [view] = fixture.views;
    assert.ok(view);
    fixture.control.views.set(0, Object.freeze({ ...view }));
    const changed = await awaitCollectorResult(Promise.allSettled([fixture.invoke(1)]));
    assert.deepEqual(changed, [{ status: 'rejected', reason: fixture.guard }]);
    const [marked] = fixture.marked;
    assert.ok(Error.isError(marked?.error));
    assert.equal(marked.error.message, 'Program group identity changed');
    assert.equal(fixture.run.inspect().reachedGroups[0]?.collector.members[1]?.arrival, 'unarrived');
    assert.equal(fixture.calls.length, 0);
    fixture.run.retire();
    await awaitCollectorResult(Promise.allSettled([pending]));
  } }),
  ...['parent', 'program', 'reach:0', 'read-group'].map(function failingBoundary(point) {
    return it({ name: `retains original ${point} failure before group publication`, fn: async () => {
      const fixture = createProgramRuntimeFixture();
      const failure = Object.freeze({ original: point });
      fixture.control.failAt = point;
      fixture.control.failure = failure;
      const result = await awaitCollectorResult(Promise.allSettled([fixture.invoke()]));
      assert.deepEqual(result, [{ status: 'rejected', reason: fixture.guard }]);
      assert.deepEqual(fixture.marked, [{ program: fixture.program, error: failure }]);
      assert.deepEqual(fixture.run.inspect().reachedGroups, []);
      assert.equal(fixture.calls.length, 0);
    } });
  }),
  it({ name: 'closes original runtime before parent checks and keeps retained evidence readable', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    fixture.run.retire();
    fixture.run.retire();
    const result = await awaitCollectorResult(Promise.allSettled([fixture.invoke()]));
    assert.deepEqual(result, [{ status: 'rejected', reason: fixture.guard }]);
    assert.deepEqual(fixture.events, ['program', 'mark']);
    const [marked] = fixture.marked;
    assert.ok(Error.isError(marked?.error));
    assert.equal(marked.error.message, 'Native program body has returned');
    assert.deepEqual(fixture.run.inspect(), { retainedOnly: true, closed: true, reachedGroups: [] });
  } }),
  //endregion
] });
