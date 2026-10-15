/** Original complete native dispatch preserves host, judgment, and member associations. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerExecutionFixture } from './native-runner-execution-fixture.ts';

await describe({ name: '', children: [
  //region Complete dispatch retains original borrowed identities and callback return values.
  it({ name: 'dispatches original parallel group and forwards original native callbacks without copying', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    const originalTail = fixture.input.runner.queueTail;
    await fixture.execute();
    const dispatch = fixture.dispatch();
    assert.deepEqual(fixture.steps, ['sequential', 'parent', 'context', 'dispatch', 'dispatch:done']);
    assert.equal(fixture.input.runner.queueTail, originalTail);
    assert.equal(dispatch.calls, fixture.input.bound.calls);
    assert.equal(dispatch.tools, fixture.input.bound.tools);
    assert.equal(dispatch.assistantMessage, fixture.input.origin.response);
    assert.equal(dispatch.context, fixture.context);
    assert.equal(dispatch.signal, fixture.abort.signal);
    assert.equal(dispatch.executionJudgment, fixture.input.origin.judgment);
    assert.equal(dispatch.executionMode, 'parallel');
    const hook = Object.freeze({ original: 'hook' });
    assert.equal(dispatch.prepare(hook), fixture.value);
    assert.equal(dispatch.after(hook), fixture.value);
    assert.deepEqual(fixture.observations, [['prepare', hook, 'parent'], ['after', hook, 'parent']]);
    assert.equal(fixture.observations[0]?.[1], hook);
    assert.equal(fixture.observations[1]?.[1], hook);
    dispatch.assertFresh();
    assert.deepEqual(fixture.steps.slice(-2), ['parent', 'current']);
    assert.equal(fixture.observations.at(-1)?.[1], fixture.input.group.handle);
    const [first, second] = fixture.input.bound.calls;
    assert.ok(first);
    assert.ok(second);
    const options = Object.freeze({ original: 'options' });
    assert.equal(dispatch.runToolCall(second, options), fixture.value);
    const invocation = fixture.observations.at(-1)?.[1];
    assert.ok((invocation !== null) && ((typeof invocation) === 'object') && ('call' in invocation) && ('options' in invocation) && ('slot' in invocation) && ('group' in invocation));
    assert.equal(invocation.call, second);
    assert.equal(invocation.options, options);
    assert.equal(invocation.slot, fixture.input.bound.slots[1]);
    assert.equal(invocation.group, fixture.input.group.handle);
    assert.equal(dispatch.runToolCall(first, undefined), fixture.value);
    assert.deepEqual(fixture.observations.at(-1), ['native', { group: fixture.input.group.handle, slot: fixture.input.bound.slots[0], call: first, options: undefined }]);
  } }),
  it({ name: 'publishes original prepared handles only after complete admission and replaces them after later assessment', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    await fixture.execute();
    const dispatch = fixture.dispatch();
    assert.throws(function beforeAssessment() { 
      dispatch.memberForExecution('parent/1'); 
    }, { message: 'Prepared child has no owned execution handle' });
    const members = Object.freeze([{ id: 'parent/1', name: 'second', input: Object.freeze({ original: 'prepared' }) }]);
    fixture.control.onStep = function duringAssessment(point) {
      if (point === 'assess') assert.throws(function beforePublication() { 
        dispatch.memberForExecution('parent/1'); 
      }, { message: 'Prepared child has no owned execution handle' });
    };
    assert.deepEqual(dispatch.assess({ members }), { block: false });
    const admission = fixture.observations.at(-1)?.[1];
    assert.ok((admission !== null) && ((typeof admission) === 'object') && ('members' in admission) && ('group' in admission) && ('nativeSignals' in admission));
    assert.equal(admission.members, members);
    assert.equal(admission.group, fixture.input.group.handle);
    assert.deepEqual(admission.nativeSignals, fixture.input.group.members.map(function signal(member) { 
      return member.signal; 
    }));
    assert.ok(Array.isArray(admission.nativeSignals));
    assert.equal(admission.nativeSignals[0], fixture.input.group.members[0]?.signal);
    assert.equal(admission.nativeSignals[1], fixture.input.group.members[1]?.signal);
    assert.equal(dispatch.memberForExecution('parent/2'), fixture.control.handles[1]);
    assert.equal(dispatch.memberForExecution('parent/1'), fixture.control.handles[0]);
    assert.throws(function unknownMember() { 
      dispatch.memberForExecution('missing'); 
    }, { message: 'Prepared child has no owned execution handle' });
    fixture.control.onStep = function ignoreStep() {};
    const previous = fixture.control.handles;
    fixture.control.handles = [Object.freeze({ original: 'replacement handle' })];
    assert.deepEqual(dispatch.assess({ members }), { block: false });
    assert.notEqual(dispatch.memberForExecution('parent/1'), previous[0]);
    assert.equal(dispatch.memberForExecution('parent/1'), fixture.control.handles[0]);
    assert.throws(function absentMember() { 
      dispatch.memberForExecution('parent/2'); 
    }, { message: 'Prepared child has no owned execution handle' });
  } }),
  it({ name: 'connects original event callbacks to the same reached group recorder and ticket', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    await fixture.execute();
    const dispatch = fixture.dispatch();
    const [call] = fixture.input.bound.calls;
    assert.ok(call);
    await dispatch.onStart(call);
    const partial = Object.freeze({ original: 'partial' });
    await dispatch.onUpdate(partial, call);
    const outcome = { toolCall: call, isError: false, result: { content: [{ type: 'text', text: 'complete' }] } };
    await dispatch.onFinish(outcome);
    assert.deepEqual(fixture.steps.slice(-6), ['start', 'tool_execution_start', 'tool_execution_update', 'finish', 'tool_execution_end', 'resolve:parent/1']);
    assert.deepEqual(fixture.observations.at(-1), ['resolve', call, outcome]);
    assert.equal(fixture.observations.at(-1)?.[2], outcome);
    assert.deepEqual(fixture.observations[3], ['finish', fixture.value, false, 'complete']);
  } }),
  //endregion
  //region Callback publication cannot replace associations captured before host context lookup.
  it({ name: 'retains original judgment and native slot association across host context replacement', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    const {judgment} = fixture.input.origin;
    const {slots} = fixture.input.bound;
    fixture.control.onStep = function replaceAtContext(point) {
      if (point !== 'context') return;
      fixture.input.origin.judgment = {
        reachedGroupFor(): never { 
          throw new Error('replacement judgment used'); 
        },
        prepareReachedMembers(): never { 
          throw new Error('replacement judgment used'); 
        },
        invokeProgramNative(): never { 
          throw new Error('replacement judgment used'); 
        }
      };
      fixture.input.bound.slots = [];
      fixture.input.bound.ordinals = new Map();
    };
    await fixture.execute();
    const dispatch = fixture.dispatch();
    assert.equal(dispatch.executionJudgment, judgment);
    const [call] = fixture.input.bound.calls;
    assert.ok(call);
    assert.equal(dispatch.runToolCall(call, undefined), fixture.value);
    assert.deepEqual(fixture.observations.at(-1), ['native', { group: fixture.input.group.handle, slot: slots[0], call, options: undefined }]);
    dispatch.assertFresh();
    assert.deepEqual(dispatch.assess({ members: [] }), { block: false });
    assert.equal(dispatch.memberForExecution(call.id), fixture.control.handles[0]);
  } }),
  it({ name: 'passes absent native member signals unchanged to the existing admission owner', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    fixture.input.group.members = [{}, {}];
    await fixture.execute();
    fixture.dispatch().assess({ members: [] });
    assert.deepEqual(fixture.observations.at(-1), ['assess', { group: fixture.input.group.handle, members: [], nativeSignals: [undefined, undefined] }]);
  } }),
  //endregion
] });
