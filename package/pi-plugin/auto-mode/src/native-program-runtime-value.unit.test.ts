/** Original script-value access distinguishes owned origins, native guards, and ordinary failures. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult } from './native-group-collector-fixture.ts';
import { createProgramRuntimeFixture, createRuntimeFixtureGuard } from './native-program-runtime-fixture.ts';

await describe({ name: '', children: [
  //region Owned tool membership and reached group association precede native conversion.
  ...[null, undefined, false, {}, Object.freeze({ name: 'first' })].map(function foreignTool(tool) {
    return it({ name: `marks unowned tool ${JSON.stringify(tool)} before result conversion`, fn: async () => {
      const fixture = createProgramRuntimeFixture();
      assert.throws(function consumeForeignResult() { 
        fixture.run.valueFor({ tool, outcome: {} }); 
      }, function originalGuard(error: unknown) { 
        return error === fixture.guard; 
      });
      const [marked] = fixture.marked;
      assert.ok(Error.isError(marked?.error));
      assert.equal(marked.error.message, 'Script result tool is not an owned program callsite');
      assert.deepEqual(fixture.converted, []);
    } });
  }),
  it({ name: 'does not reconstruct original tool custody from copied callable metadata', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const tool = Object.freeze({ ...fixture.tool() });
    assert.throws(function copiedTool() { 
      fixture.run.valueFor({ tool, outcome: {} }); 
    }, function originalGuard(error: unknown) { 
      return error === fixture.guard; 
    });
    assert.deepEqual(fixture.converted, []);
  } }),
  it({ name: 'marks owned tool whose original source group has never been reached', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    assert.throws(function unreachedGroup() { 
      fixture.run.valueFor({ tool: fixture.tool(), outcome: {} }); 
    }, function originalGuard(error: unknown) { 
      return error === fixture.guard; 
    });
    const [marked] = fixture.marked;
    assert.ok(Error.isError(marked?.error));
    assert.equal(marked.error.message, 'Script result group was not reached');
    assert.deepEqual(fixture.converted, []);
  } }),
  it({ name: 'preserves original outcome and converted value identity through both currentness checks', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const pending = fixture.invoke(2);
    const [completion] = fixture.completions(1);
    assert.ok(completion);
    const outcome = Object.freeze({ original: 'native outcome' });
    completion.resolve(outcome);
    assert.equal(await awaitCollectorResult(pending), outcome);
    const converted = Object.freeze({ original: 'script value' });
    fixture.control.value = converted;
    fixture.control.programView = undefined;
    fixture.events.length = 0;
    assert.equal(fixture.run.valueFor({ tool: fixture.tool(2), outcome }), converted);
    assert.deepEqual(fixture.converted, [{ group: fixture.views[1]?.handle, ordinal: 0, outcome }]);
    assert.deepEqual(fixture.events, ['parent', 'program', 'convert', 'parent', 'program']);
    assert.equal(fixture.run.declaration, fixture.declaration);
    assert.deepEqual(fixture.marked, []);
  } }),
  //endregion
  //region Ordinary conversion failures remain unmarked while original native guard categories are retained.
  ...[undefined, null, 'failure', new Error('original native conversion failure'), Object.freeze({ original: 'opaque native failure' })].map(function ordinaryFailure(failure) {
    return it({ name: `preserves ordinary conversion failure ${JSON.stringify(failure)} without program marking`, fn: async () => {
      const fixture = createProgramRuntimeFixture();
      const pending = fixture.invoke(2);
      const [completion] = fixture.completions(1);
      assert.ok(completion);
      completion.resolve('native result');
      await awaitCollectorResult(pending);
      fixture.control.failAt = 'convert';
      fixture.control.failure = failure;
      fixture.events.length = 0;
      try {
        fixture.run.valueFor({ tool: fixture.tool(2), outcome: 'native result' });
        assert.fail('Original conversion failure was discarded');
      } catch (error) { 
        assert.equal(error, failure); 
      }
      assert.deepEqual(fixture.events, ['parent', 'program', 'convert']);
      assert.deepEqual(fixture.marked, []);
    } });
  }),
  it({ name: 'passes original native guard identity to the judgment and throws its returned guard', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const pending = fixture.invoke(2);
    const [completion] = fixture.completions(1);
    assert.ok(completion);
    completion.resolve('native result');
    await awaitCollectorResult(pending);
    const nativeGuard = createRuntimeFixtureGuard(Object.freeze({ original: 'value guard cause' }));
    fixture.control.failAt = 'convert';
    fixture.control.failure = nativeGuard;
    assert.throws(function consumeGuardedValue() { 
      fixture.run.valueFor({ tool: fixture.tool(2), outcome: 'native result' }); 
    }, function originalGuard(error: unknown) { 
      return error === fixture.guard; 
    });
    assert.deepEqual(fixture.marked, [{ program: fixture.program, error: nativeGuard }]);
    assert.deepEqual(await awaitCollectorResult(Promise.allSettled([fixture.run.drain()])), [{ status: 'rejected', reason: fixture.guard }]);
  } }),
  ...['retire', 'parent-failure'].map(function conversionTail(change) {
    return it({ name: `checks currentness after conversion publishes ${change}`, fn: async () => {
      const fixture = createProgramRuntimeFixture();
      const pending = fixture.invoke(2);
      const [completion] = fixture.completions(1);
      assert.ok(completion);
      completion.resolve('native result');
      await awaitCollectorResult(pending);
      const failure = Object.freeze({ original: 'tail parent failure' });
      fixture.control.onStep = function changeAfterConversion(point): void {
        if (point !== 'convert') return;
        if (change === 'retire') fixture.run.retire();
        else { 
          fixture.control.failAt = 'parent'; 
          fixture.control.failure = failure; 
        }
      };
      assert.throws(function rejectChangedTail() { 
        fixture.run.valueFor({ tool: fixture.tool(2), outcome: 'native result' }); 
      }, function originalGuard(error: unknown) { 
        return error === fixture.guard; 
      });
      assert.equal(fixture.converted.length, 1);
      const [marked] = fixture.marked;
      assert.ok(marked);
      if (change === 'retire') { 
        assert.ok(Error.isError(marked.error)); 
        assert.equal(marked.error.message, 'Native program body has returned'); 
      }
      else assert.equal(marked.error, failure);
    } });
  }),
  it({ name: 'preserves the guard-retention callback failure without replacing it', fn: async () => {
    const fixture = createProgramRuntimeFixture();
    const failure = Object.freeze({ original: 'guard retention failed' });
    fixture.control.failAt = 'mark';
    fixture.control.failure = failure;
    try { 
      fixture.run.valueFor({ tool: {}, outcome: undefined }); 
      assert.fail('Original retention callback failure was discarded'); 
    }
    catch (error) { 
      assert.equal(error, failure); 
    }
    assert.equal(fixture.marked.length, 1);
    assert.deepEqual(fixture.guards, []);
  } }),
  //endregion
] });
