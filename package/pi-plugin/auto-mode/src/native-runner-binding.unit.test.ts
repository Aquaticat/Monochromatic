/** Original native binding preserves scope, calls, slots, and callback failures. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerBindingFixture, runnerBindingModule } from './native-runner-binding-fixture.ts';

await describe({ name: '', children: [
  //region Original source association preserves complete native call and result transport identities.
  it({ name: 'binds complete original calls before exposing distinct unresolved result tickets', fn: async () => {
    const fixture = createRunnerBindingFixture();
    const bound = fixture.bind();
    const admission = fixture.admission();
    assert.deepEqual(fixture.events, ['parent', 'recorder', 'bind']);
    assert.equal(bound.scope.recorder, fixture.recorder);
    assert.equal(bound.scope.owner, fixture.input.carrier.token);
    assert.equal(bound.scope.nextId, 3);
    assert.equal(bound.scope.holdsQueue, false);
    assert.equal(fixture.input.runner.scopes.get('parent'), bound.scope);
    assert.equal(fixture.input.runner.scopes.get(fixture.input.carrier.token), bound.scope);
    assert.equal(admission.group, fixture.input.group.handle);
    assert.equal(admission.calls, bound.calls);
    assert.equal(bound.tools, fixture.input.tools);
    assert.equal(bound.slots, fixture.slots);
    assert.deepEqual(bound.calls.map(function nativeMetadata(call) { return [call.type, call.id, call.name]; }), [['toolCall', 'parent/1', 'second'], ['toolCall', 'parent/2', 'first']]);
    assert.deepEqual([...bound.ordinals], [['parent/1', 0], ['parent/2', 1]]);
    assert.equal(admission.tools[0], fixture.input.tools[1]);
    assert.equal(admission.tools[1], fixture.input.tools[0]);
    assert.equal(bound.calls[0]?.arguments, fixture.input.group.members[0]?.declaration.args);
    assert.equal(bound.calls[1]?.arguments, fixture.input.group.members[1]?.declaration.args);
    const [first, second] = bound.tickets;
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first, second);
    assert.notEqual(first.promise, second.promise);
    assert.equal(await Promise.race([first.promise, setImmediate('pending')]), 'pending');
    const outcome = Object.freeze({ original: 'completed outcome' });
    first.resolve(outcome);
    second.resolve(undefined);
    assert.equal(await first.promise, outcome);
  } }),
  it({ name: 'reuses original recorder and advances shared parent numbering across reached groups', fn: async () => {
    const fixture = createRunnerBindingFixture();
    const first = fixture.bind();
    first.scope.holdsQueue = true;
    const second = fixture.bind();
    assert.equal(second.scope, first.scope);
    assert.equal(second.scope.nextId, 5);
    assert.equal(second.scope.holdsQueue, true);
    assert.deepEqual(second.calls.map(function id(call) { return call.id; }), ['parent/3', 'parent/4']);
    assert.deepEqual(fixture.events, ['parent', 'recorder', 'bind', 'parent', 'bind']);
  } }),
  it({ name: 'passes an absent original tool definition to judgment admission unchanged', fn: async () => {
    const fixture = createRunnerBindingFixture();
    const bound = runnerBindingModule.bindReachedProgramGroup({ ...fixture.input, tools: [] });
    assert.deepEqual(fixture.admission().tools, [undefined, undefined]);
    assert.equal(bound.slots, fixture.slots);
  } }),
  //endregion
  //region Original callback failures retain their opaque identity and already published partial scope state.
  ...['parent', 'recorder', 'bind'].map(function callbackFailure(point) {
    return it({ name: `preserves original ${point} failure and exact prior scope publication`, fn: async () => {
      const fixture = createRunnerBindingFixture();
      const failure = Object.freeze({ original: point });
      fixture.control.failAt = point;
      fixture.control.failure = failure;
      assert.throws(function failBinding() { fixture.bind(); }, function original(error: unknown) { return error === failure; });
      assert.deepEqual(fixture.events, point === 'parent' ? ['parent'] : point === 'recorder' ? ['parent', 'recorder'] : ['parent', 'recorder', 'bind']);
      assert.equal(fixture.input.runner.scopes.size, point === 'bind' ? 2 : 0);
      if (point === 'bind') assert.equal(fixture.input.runner.scopes.get('parent')?.nextId, 3);
    } });
  }),
  //endregion
] });
