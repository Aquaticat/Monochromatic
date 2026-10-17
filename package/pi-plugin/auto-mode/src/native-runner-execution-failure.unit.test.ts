/** Original execution failures retain identity and stop later lifecycle callbacks. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerExecutionFixture } from './native-runner-execution-fixture.ts';

await describe({ name: '', children: [
  //region Entry failures preserve exact callback order and release only an acquired queue.
  ...['sequential', 'parent', 'context', 'dispatch'].map(function failureAt(point) {
    return it({ name: `retains original ${point} failure and stops dispatch entry`, fn: async () => {
      const fixture = createRunnerExecutionFixture();
      fixture.control.sequential = true;
      fixture.control.failAt = point;
      const previous = fixture.input.runner.queueTail;
      let caught: unknown;
      try { 
        await fixture.execute(); 
      } catch (error) { 
        caught = error; 
      }
      assert.equal(caught, fixture.control.failure);
      const order = ['sequential', 'parent', 'context', 'dispatch'];
      assert.deepEqual(fixture.steps, order.slice(0, order.indexOf(point) + 1));
      assert.equal(fixture.dispatched.length, point === 'dispatch' ? 1 : 0);
      assert.equal(fixture.input.runner.queueTail === previous, point === 'sequential');
      assert.equal(await Promise.race([fixture.input.runner.queueTail, setImmediate('missing-release')]), undefined);
    } });
  }),
  //endregion
  //region Borrowed callback failures retain opaque values and prior prepared-member publication.
  ...['prepare', 'after', 'parent', 'current', 'assess'].map(function callbackFailure(point) {
    return it({ name: `retains original ${point} callback failure without replacing admitted handles`, fn: async () => {
      const fixture = createRunnerExecutionFixture();
      await fixture.execute();
      const dispatch = fixture.dispatch();
      const members = Object.freeze([{ id: 'parent/1', name: 'second', input: Object.freeze({}) }]);
      dispatch.assess({ members });
      const previous = dispatch.memberForExecution('parent/1');
      fixture.control.handles = [Object.freeze({ original: 'unpublished' })];
      fixture.control.failAt = point;
      const [call] = fixture.input.bound.calls;
      assert.ok(call);
      const start = fixture.steps.length;
      let caught: unknown;
      try {
        if (point === 'prepare') dispatch.prepare({});
        else if (point === 'after') dispatch.after({});
        else if ((point === 'parent') || (point === 'current')) dispatch.assertFresh();
        else dispatch.assess({ members });
      } catch (error) { 
        caught = error; 
      }
      assert.equal(caught, fixture.control.failure);
      assert.deepEqual(fixture.steps.slice(start), point === 'current' ? ['parent', 'current'] : [point]);
      assert.equal(dispatch.memberForExecution('parent/1'), previous);
    } });
  }),
  //endregion
] });
