/** Built native callbacks preserve recording, event payloads, and delayed member settlement. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerEventsFixture } from './native-runner-events-fixture.ts';

await describe({ name: '', children: [
  //region Start and update callbacks preserve exact payloads and await original host completion.
  it({ name: 'records original entry before awaiting exact start and update events', fn: async () => {
    const fixture = createRunnerEventsFixture();
    const [call] = fixture.calls;
    assert.ok(call);
    fixture.control.waitAt = 'tool_execution_start';
    const start = fixture.callbacks.onStart(call);
    assert.equal(await Promise.race([start, setImmediate('pending')]), 'pending');
    assert.deepEqual(fixture.steps, ['start', 'tool_execution_start']);
    assert.deepEqual(fixture.recordings, [['start', call]]);
    assert.equal(fixture.input.records.get(call.id), fixture.control.record);
    assert.deepEqual(fixture.events, [{ type: 'tool_execution_start', toolCallId: call.id, toolName: call.name, args: call.arguments, parentToolCallId: 'parent' }]);
    fixture.control.barrier.resolve();
    await start;
    fixture.control.barrier = Promise.withResolvers<void>();
    fixture.control.waitAt = 'tool_execution_update';
    const partial = Object.freeze({ original: 'partial' });
    const update = fixture.callbacks.onUpdate(partial, call);
    assert.equal(await Promise.race([update, setImmediate('pending')]), 'pending');
    assert.deepEqual(fixture.events[1], { type: 'tool_execution_update', toolCallId: call.id, toolName: call.name, args: call.arguments, partialResult: partial, parentToolCallId: 'parent' });
    fixture.control.barrier.resolve();
    await update;
    assert.deepEqual(fixture.steps, ['start', 'tool_execution_start', 'tool_execution_start:done', 'tool_execution_update', 'tool_execution_update:done']);
    assert.deepEqual(fixture.resolutions, []);
  } }),
  //endregion
  //region Original completion records text and usage before publishing and settling the associated member.
  it({ name: 'records filtered text and exact usage then awaits end before resolving reverse-order members', fn: async () => {
    const fixture = createRunnerEventsFixture();
    const [first, second] = fixture.calls;
    assert.ok(first);
    assert.ok(second);
    await fixture.callbacks.onStart(second);
    fixture.control.waitAt = 'tool_execution_end';
    const usage = Object.freeze({ original: 'usage' });
    const outcome = { toolCall: second, isError: true, result: { content: [{ type: 'text', text: 'a' }, { type: 'image', text: 'omit' }, { type: 'text', text: null }, { type: 'text', text: 7 }, { type: 'text' }], usage } };
    const finish = fixture.callbacks.onFinish(outcome);
    assert.equal(await Promise.race([finish, setImmediate('pending')]), 'pending');
    assert.deepEqual(fixture.recordings, [['start', second], ['finish', fixture.control.record, true, 'a\n\n7\n'], ['usage', usage]]);
    assert.deepEqual(fixture.events[1], { type: 'tool_execution_end', toolCallId: second.id, toolName: second.name, result: outcome.result, isError: true, parentToolCallId: 'parent' });
    assert.deepEqual(fixture.resolutions, []);
    fixture.control.barrier.resolve();
    await finish;
    assert.deepEqual(fixture.resolutions, [[1, outcome]]);
    assert.equal(fixture.resolutions[0]?.[1], outcome);
    const unstarted = { toolCall: first, isError: false, result: {} };
    await fixture.callbacks.onFinish(unstarted);
    assert.deepEqual(fixture.recordings.at(-1), ['finish', undefined, false, '']);
    assert.deepEqual(fixture.resolutions, [[1, outcome], [0, unstarted]]);
    assert.deepEqual(fixture.steps, ['start', 'tool_execution_start', 'tool_execution_start:done', 'finish', 'usage', 'tool_execution_end', 'tool_execution_end:done', 'resolve:parent/2', 'finish', 'tool_execution_end', 'tool_execution_end:done', 'resolve:parent/1']);
  } }),
  ...[undefined, null, false, 0, '', Object.freeze({}), 1, 'usage'].map(function usageCase(usage, index) {
    return it({ name: `preserves original usage truthiness for case ${index}`, fn: async () => {
      const fixture = createRunnerEventsFixture();
      const [call] = fixture.calls;
      assert.ok(call);
      const outcome = { toolCall: call, isError: false, result: { content: null, usage } };
      await fixture.callbacks.onFinish(outcome);
      assert.deepEqual(fixture.recordings, usage ? [['finish', undefined, false, ''], ['usage', usage]] : [['finish', undefined, false, '']]);
      assert.deepEqual(fixture.resolutions, [[0, outcome]]);
    } });
  }),
  it({ name: 'preserves overwritten and undefined recorder starts in the original shared map', fn: async () => {
    const fixture = createRunnerEventsFixture();
    const [call] = fixture.calls;
    assert.ok(call);
    await fixture.callbacks.onStart(call);
    fixture.control.record = undefined;
    await fixture.callbacks.onStart(call);
    assert.equal(fixture.input.records.has(call.id), true);
    assert.equal(fixture.input.records.get(call.id), undefined);
    await fixture.callbacks.onFinish({ toolCall: call, isError: false, result: {} });
    assert.deepEqual(fixture.recordings.at(-1), ['finish', undefined, false, '']);
  } }),
  //endregion
] });
