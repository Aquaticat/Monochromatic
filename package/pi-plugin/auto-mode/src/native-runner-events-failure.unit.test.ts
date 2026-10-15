/** Original native callback failures retain their identity and stop later event publication. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerEventsFixture } from './native-runner-events-fixture.ts';

await describe({ name: '', children: [
  //region Every original callback boundary can fail without resolving a later member ticket.
  ...['start', 'tool_execution_start', 'tool_execution_update', 'finish', 'usage', 'tool_execution_end', 'resolve:parent/1'].map(function failureAt(point) {
    return it({ name: `retains opaque failure from ${point} and stops subsequent callbacks`, fn: async () => {
      const fixture = createRunnerEventsFixture();
      const [call] = fixture.calls;
      assert.ok(call);
      fixture.control.failAt = point;
      let caught: unknown;
      try {
        if ((point === 'start') || (point === 'tool_execution_start')) await fixture.callbacks.onStart(call);
        else if (point === 'tool_execution_update') await fixture.callbacks.onUpdate({}, call);
        else await fixture.callbacks.onFinish({ toolCall: call, isError: true, result: { usage: {} } });
      }
      catch (error) { caught = error; }
      assert.equal(caught, fixture.control.failure);
      const expected = point === 'start' ? ['start'] : point === 'tool_execution_start' ? ['start', point] : point === 'tool_execution_update' ? [point] : point === 'finish' ? ['finish'] : point === 'usage' ? ['finish', point] : point === 'tool_execution_end' ? ['finish', 'usage', point] : ['finish', 'usage', 'tool_execution_end', 'tool_execution_end:done', point];
      assert.deepEqual(fixture.steps, expected);
      assert.equal(fixture.resolutions.length, point === 'resolve:parent/1' ? 1 : 0);
      assert.equal(fixture.input.records.has(call.id), point === 'tool_execution_start');
    } });
  }),
  it({ name: 'observes result and usage getters in their original order without capturing replacement values', fn: async () => {
    const fixture = createRunnerEventsFixture();
    const [call] = fixture.calls;
    assert.ok(call);
    const reads: string[] = [];
    const usage = Object.freeze({ original: 'second usage read' });
    let usageReads = 0;
    const result = {
      get content() { reads.push('content'); return [{ type: 'text', text: 'done' }]; },
      get usage() { reads.push('usage'); usageReads++; return usageReads === 1 ? true : usage; }
    };
    const outcome = { toolCall: call, isError: false, get result() { reads.push('result'); return result; } };
    fixture.control.onStep = function recordStep(point) { reads.push(point); };
    await fixture.callbacks.onFinish(outcome);
    assert.deepEqual(reads, ['result', 'content', 'finish', 'result', 'usage', 'result', 'usage', 'usage', 'result', 'tool_execution_end', 'tool_execution_end:done', 'resolve:parent/1']);
    assert.deepEqual(fixture.recordings, [['finish', undefined, false, 'done'], ['usage', usage]]);
  } }),
  it({ name: 'retains original join coercion failure before recorder or event publication', fn: async () => {
    const fixture = createRunnerEventsFixture();
    const [call] = fixture.calls;
    assert.ok(call);
    const text = { toString(): string { throw fixture.control.failure; } };
    let caught: unknown;
    try { await fixture.callbacks.onFinish({ toolCall: call, isError: false, result: { content: [{ type: 'text', text }] } }); }
    catch (error) { caught = error; }
    assert.equal(caught, fixture.control.failure);
    assert.deepEqual(fixture.steps, []);
    assert.deepEqual(fixture.events, []);
  } }),
  //endregion
] });
