/** Original reached-group scheduling preserves queue ownership and complete dispatch lifetime. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerExecutionFixture } from './native-runner-execution-fixture.ts';

await describe({ name: '', children: [
  //region Original host and tool scheduling choose queue acquisition without changing parent ownership.
  ...['host', 'tool', 'parent', 'duplicate', 'unused', 'missing'].map(function schedulingCase(kind) {
    return it({ name: `retains original ${kind} queue selection and short-circuit behavior`, fn: async () => {
      const fixture = createRunnerExecutionFixture();
      const previous = Promise.withResolvers<void>();
      fixture.input.runner.queueTail = previous.promise;
      fixture.control.sequential = (kind === 'host') || (kind === 'parent');
      fixture.input.bound.scope.holdsQueue = kind === 'parent';
      if (kind === 'tool') fixture.input.bound.tools = [{ name: 'first', executionMode: 'sequential' }, { name: 'second' }];
      if (kind === 'duplicate') fixture.input.bound.tools = [{ name: 'first' }, { name: 'first', executionMode: 'sequential' }, { name: 'second' }];
      if (kind === 'unused') fixture.input.bound.tools = [...fixture.input.bound.tools, { name: 'unused', executionMode: 'sequential' }];
      if (kind === 'missing') fixture.input.bound.tools = [];
      const exclusive = (kind === 'host') || (kind === 'tool');
      const work = fixture.execute();
      if (exclusive) {
        assert.notEqual(fixture.input.runner.queueTail, previous.promise);
        assert.equal(await Promise.race([work, setImmediate('pending')]), 'pending');
        assert.deepEqual(fixture.steps, ['sequential']);
        assert.deepEqual(fixture.dispatched, []);
      } else {
        assert.equal(await Promise.race([work, setImmediate('pending')]), undefined);
        assert.equal(fixture.input.runner.queueTail, previous.promise);
      }
      previous.resolve();
      await work;
      assert.equal(fixture.dispatch().executionMode, exclusive ? 'sequential' : 'parallel');
      assert.deepEqual(fixture.steps, kind === 'parent' ? ['parent', 'context', 'dispatch', 'dispatch:done'] : ['sequential', 'parent', 'context', 'dispatch', 'dispatch:done']);
      assert.equal(fixture.input.bound.scope.holdsQueue, kind === 'parent');
      assert.equal(await Promise.race([fixture.input.runner.queueTail, setImmediate('missing-release')]), undefined);
    } });
  }),
  ...[false, true].map(function dispatchCompletion(failed) {
    return it({ name: `holds original queue through ${failed ? 'failed' : 'successful'} asynchronous dispatch and releases it`, fn: async () => {
      const fixture = createRunnerExecutionFixture();
      fixture.control.sequential = true;
      const barrier = Promise.withResolvers<void>();
      fixture.control.dispatch = async function pendingDispatch(): Promise<void> { 
        await barrier.promise; 
      };
      const work = fixture.execute();
      const tail = fixture.input.runner.queueTail;
      assert.equal(await Promise.race([work, setImmediate('pending')]), 'pending');
      assert.equal(fixture.dispatched.length, 1);
      assert.equal(await Promise.race([tail, setImmediate('pending')]), 'pending');
      if (failed) barrier.reject(fixture.control.failure);
      else barrier.resolve();
      let caught: unknown;
      try { 
        await work; 
      } catch (error) { 
        caught = error; 
      }
      assert.equal(caught, failed ? fixture.control.failure : undefined);
      assert.equal(await Promise.race([tail, setImmediate('missing-release')]), undefined);
      assert.equal(fixture.steps.includes('dispatch:done'), !failed);
    } });
  }),
  ...['parent', 'cancelled'].map(function afterAcquisition(kind) {
    return it({ name: `rechecks original ${kind} state only after waiting and releases acquired queue on failure`, fn: async () => {
      const fixture = createRunnerExecutionFixture();
      fixture.control.sequential = true;
      const previous = Promise.withResolvers<void>();
      fixture.input.runner.queueTail = previous.promise;
      const work = fixture.execute();
      const tail = fixture.input.runner.queueTail;
      assert.equal(await Promise.race([work, setImmediate('pending')]), 'pending');
      assert.deepEqual(fixture.steps, ['sequential']);
      if (kind === 'parent') fixture.control.failAt = 'parent';
      else fixture.abort.abort(fixture.control.failure);
      previous.resolve();
      let caught: unknown;
      try { 
        await work; 
      } catch (error) { 
        caught = error; 
      }
      assert.equal(caught, fixture.control.failure);
      assert.deepEqual(fixture.steps, ['sequential', 'parent']);
      assert.deepEqual(fixture.dispatched, []);
      assert.equal(await Promise.race([tail, setImmediate('missing-release')]), undefined);
    } });
  }),
  it({ name: 'retains predecessor failure and the published unresolved successor without entering parent checks', fn: async () => {
    const fixture = createRunnerExecutionFixture();
    fixture.control.sequential = true;
    const previous = Promise.withResolvers<void>();
    fixture.input.runner.queueTail = previous.promise;
    const work = fixture.execute();
    previous.reject(fixture.control.failure);
    let caught: unknown;
    try { 
      await work; 
    } catch (error) { 
      caught = error; 
    }
    assert.equal(caught, fixture.control.failure);
    assert.notEqual(fixture.input.runner.queueTail, previous.promise);
    assert.equal(await Promise.race([fixture.input.runner.queueTail, setImmediate('pending')]), 'pending');
    assert.deepEqual(fixture.steps, ['sequential']);
    assert.deepEqual(fixture.dispatched, []);
  } }),
  //endregion
] });
