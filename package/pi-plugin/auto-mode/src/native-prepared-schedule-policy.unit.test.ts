/** Built scheduling checks capability ownership and original tool lookup order. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { judgment, schedule, unexpectedExecution } from './native-prepared-schedule-fixture.ts';

await describe({ name: 'prepared schedule policy', children: [
  //region Judgment capabilities are inspected in order without invoking any capability.
  ...[undefined, null, false, 0, ''].map(function absentJudgment(executionJudgment) {
    return it({ name: `rejects original falsy judgment ${JSON.stringify(executionJudgment)}`, fn: async function unsupportedJudgment() {
      assert.throws(function reject() { schedule({ executionJudgment }); }, { message: 'Enclosing judgment lacks required native execution occurrence support' });
    } });
  }),
  ...['memberFor', 'beginExecution', 'executionFor', 'finishExecution'].map(function capability(name) {
    return it({ name: `rejects missing and nonfunction ${name} support`, fn: async function unsupportedCapability() {
      for (const value of [undefined, true]) {
        assert.throws(function reject() { schedule({ executionJudgment: { ...judgment(), [name]: value } }); }, { message: 'Enclosing judgment lacks required native execution occurrence support' });
      }
    } });
  }),
  it({ name: 'accepts inherited and callable judgment support without invoking capabilities', fn: async function inheritedCapabilities() {
    const inherited: unknown = Object.create(judgment());
    assert.doesNotThrow(function accept() { assert.equal(schedule({ executionJudgment: inherited }).serial, false); });
    const callable = function enclosingJudgment() { throw new Error('Judgment must not run'); };
    for (const [name, value] of Object.entries(judgment())) Object.defineProperty(callable, name, { value });
    assert.doesNotThrow(function acceptCallable() { assert.equal(schedule({ executionJudgment: callable }).serial, false); });
  } }),
  it({ name: 'stops at the first missing capability before observing later judgment or tool properties', fn: async function shortCircuit() {
    const executionJudgment = { memberFor: undefined, get beginExecution() { throw new Error('Later judgment was read'); } };
    assert.throws(function reject() { schedule({ executionJudgment, tools: undefined }); }, { message: 'Enclosing judgment lacks required native execution occurrence support' });
  } }),
  it({ name: 'preserves opaque judgment getter failure', fn: async function judgmentFailure() {
    const failure: unknown = Object.freeze({ reason: 'judgment getter' });
    assert.throws(function reject() { schedule({ executionJudgment: { get memberFor() { throw failure; } } }); }, function sameFailure(error: unknown) { return error === failure; });
  } }),
  //endregion
  //region The first matching tool owns context support and serial policy independently of later duplicates.
  it({ name: 'permits absent tool definitions and defaults to parallel execution', fn: async function missingTool() {
    assert.doesNotThrow(function accept() { assert.equal(schedule({ tools: [] }).serial, false); });
    assert.equal(schedule({ executionMode: 'parallel' }).serial, false);
  } }),
  it({ name: 'rejects missing context support even with explicit sequential scheduling', fn: async function missingContext() {
    for (const executionMode of ['parallel', 'sequential']) {
      assert.throws(function reject() { schedule({ tools: [{ name: 'tool' }], executionMode }); }, { message: 'Tool "tool" lacks required native context support; the complete group was not started' });
    }
  } }),
  it({ name: 'uses only the first matching context definition and execution policy', fn: async function firstMatch() {
    const valid = { name: 'tool', createExecutionContext: unexpectedExecution, executionMode: 'parallel' };
    const later = { name: 'tool', get createExecutionContext() { throw new Error('Later context was inspected'); }, get executionMode() { throw new Error('Later policy was inspected'); } };
    assert.doesNotThrow(function firstOnly() { assert.equal(schedule({ tools: [valid, later] }).serial, false); });
    assert.throws(function firstMissing() { schedule({ tools: [{ name: 'tool' }, valid] }); }, { message: 'Tool "tool" lacks required native context support; the complete group was not started' });
  } }),
  it({ name: 'explicit sequential mode skips all tool policy reads after context validation', fn: async function explicitSerial() {
    const tools = [{ name: 'tool', createExecutionContext: unexpectedExecution, get executionMode() { throw new Error('Explicit serial read tool policy'); } }];
    assert.doesNotThrow(function skipPolicy() { assert.equal(schedule({ tools, executionMode: 'sequential' }).serial, true); });
  } }),
  it({ name: 'checks every context before short circuiting serial policy at its first sequential member', fn: async function observationOrder() {
    const events: string[] = [];
    const calls = ['one', 'two'].map(function call(id) { return { type: 'toolCall', id, name: id, arguments: {} }; });
    const tools = ['one', 'two'].map(function tool(name) {
      return { name, get createExecutionContext() { events.push(`context:${name}`);
      return unexpectedExecution; },
        get executionMode() { events.push(`policy:${name}`);
        return 'sequential'; } };
    });
    assert.equal(schedule({ calls, tools }).serial, true);
    assert.deepEqual(events, ['context:one', 'context:two', 'policy:one']);
  } }),
  it({ name: 'retains judgment, context, and policy getter ordering for a parallel group', fn: async function parallelOrder() {
    const events: string[] = [];
    const executionJudgment = new Proxy(judgment(), { get(target, name, receiver) { events.push(String(name));
    return Reflect.get(target, name, receiver); } });
    const tools = [{ name: 'tool', get createExecutionContext() { events.push('context');
    return unexpectedExecution; }, get executionMode() { events.push('policy');
    return 'parallel'; } }];
    assert.equal(schedule({ executionJudgment, tools }).serial, false);
    assert.deepEqual(events, ['memberFor', 'beginExecution', 'executionFor', 'finishExecution', 'context', 'policy']);
  } }),
  it({ name: 'uses the frozen cloned name after original call mutation', fn: async function clonedName() {
    const call = { type: 'toolCall', id: 'one', name: 'tool', get arguments() { this.name = 'changed';
    return {}; } };
    const result = schedule({ calls: [call], tools: [{ name: 'tool', createExecutionContext: unexpectedExecution, executionMode: 'sequential' }] });
    assert.equal(call.name, 'changed');
    assert.equal(result.scheduled[0]?.name, 'tool');
    assert.equal(result.serial, true);
  } }),
  it({ name: 'retains native tool lookup failure for malformed tool collections', fn: async function malformedTools() {
    assert.throws(function reject() { schedule({ tools: undefined }); }, TypeError);
  } }),
  //endregion
] });
