/** Built binding segments preserve original operation values and paired postcheck failures. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createDependencyFixture } from './native-dependency-fixture.ts';

//region Internal freshness caching ends before original external postchecks execute.
await describe({ name: '', children: [
  it({ name: 'brackets internal identity reads with fresh original checks and forbids nested segments', fn: async function boundsInternalReads() {
    /** Entry and exit observers must see the released segment state. */
    const f = createDependencyFixture();
    /** Original return identity must survive internal and external checks. */
    const value = Object.freeze({});
    assert.equal(f.owner.bindingSegment(function originalOperation() {
      assert.equal(f.owner.isBindingSegmentActive(), true);
      assert.deepEqual(f.events, ['state', 'checkpoint', 'request', 'program:z', 'program:a', 'state', 'state', 'finalize', 'checkpoint', 'program:z', 'program:a']);
      f.events.length = 0;
      assert.throws(function nestedSegment() {
        f.owner.bindingSegment(function forbiddenNestedBody() { 
          throw new Error('nested body must not run'); 
        });
      }, { message: 'Original binding segments cannot nest' });
      assert.deepEqual(f.events, []);
      f.owner.ready();
      assert.deepEqual(f.events, ['state', 'checkpoint', 'state', 'checkpoint']);
      f.events.length = 0;
      assert.equal(f.owner.dependencyCheck(function internalRead() { 
        f.events.push('internal');
      return value; 
      }), value);
      assert.deepEqual(f.events, ['internal']);
      f.state.onStep = function releasedPostcheck() { 
        assert.equal(f.owner.isBindingSegmentActive(), false); 
      };
      return value;
    }), value);
    assert.equal(f.owner.isBindingSegmentActive(), false);
    assert.deepEqual(f.events, ['internal', 'trace', 'state', 'checkpoint', 'request', 'program:z', 'program:a', 'state', 'state', 'finalize', 'checkpoint', 'program:z', 'program:a']);
    assert.equal(f.owner.bindingSegment(function originalUndefined() { 
      return undefined; 
    }), undefined);
  } }),
  it({ name: 'does not enter a segment or trace after readiness preflight fails', fn: async function excludesFailedEntry() {
    /** Incomplete membership refuses the operation before any segment flag changes. */
    const f = createDependencyFixture();
    f.preparation.prepared = false;
    assert.throws(function unpreparedSegment() {
      f.owner.bindingSegment(function forbiddenOperation() { 
        throw new Error('operation must not enter'); 
      });
    }, { message: 'Complete final prepared membership is unavailable' });
    assert.equal(f.owner.isBindingSegmentActive(), false);
    assert.equal(f.events.includes('trace'), false);
    f.preparation.prepared = true;
    assert.equal(f.owner.bindingSegment(function recoveredOperation() { 
      return f.handle; 
    }), f.handle);
  } }),
  ...[new Error('original binding failed'), undefined, null, 'original primitive failure'].map(function originalFailure(failure, ordinal) {
    return it({ name: `preserves original operation failure ${ordinal} after successful postcheck`, fn: async function preservesFailure() {
      /** A body failure alone does not retire dependency eligibility. */
      const f = createDependencyFixture();
      f.state.failures.set('operation', failure);
      assert.throws(function failedOperation() {
        f.owner.bindingSegment(f.operation);
      }, function same(error: unknown) { 
        return error === failure; 
      });
      assert.equal(f.owner.isBindingSegmentActive(), false);
      assert.equal(f.events.includes('trace'), true);
      f.owner.ready();
    } });
  }),
  ...['trace', 'state', 'checkpoint', 'request', 'program:z', 'finalize'].map(function postcheckPoint(point) {
    return it({ name: `releases original segment before permanent ${point} postcheck failure`, fn: async function retiresPostcheck() {
      /** The operation completes before a selected postcheck callback fails. */
      const f = createDependencyFixture();
      /** This exact failure must be returned and retained as the first eligibility cause. */
      const failure = new Error(`original ${point} postcheck failed`);
      assert.throws(function failedPostcheck() {
        f.owner.bindingSegment(function originalOperation() {
          f.events.length = 0;
          f.state.failures.set(point, failure);
          f.state.onStep = function releasedBeforePostcheck() { 
            assert.equal(f.owner.isBindingSegmentActive(), false); 
          };
          return f.handle;
        });
      }, function same(error: unknown) { 
        return error === failure; 
      });
      assert.equal(f.owner.isBindingSegmentActive(), false);
      assert.equal(f.events[0], 'trace');
      f.state.failures.clear();
      delete f.state.onStep;
      f.events.length = 0;
      assert.throws(function retiredSegment() { 
        f.owner.ready(); 
      }, { message: 'Original relation evidence lost dependency eligibility', cause: failure });
      assert.deepEqual(f.events, []);
    } });
  }),
  ...[false, true].map(function pairedUndefined(useUndefined) {
    return it({ name: `preserves ordered paired failures with undefined values ${String(useUndefined)}`, fn: async function pairedFailures() {
      /** Both failures remain peers rather than one replacing the other. */
      const f = createDependencyFixture();
      /** Nullish original throws must still count as failures. */
      const operationFailure = useUndefined ? undefined : new Error('operation failed');
      /** Distinct second failure becomes the retained eligibility cause. */
      const postcheckFailure = useUndefined ? undefined : new Error('postcheck failed');
      f.state.failures.set('operation', operationFailure);
      assert.throws(function pairedFailure() {
        f.owner.bindingSegment(function failedOriginal() {
          f.state.failures.set('trace', postcheckFailure);
          return f.operation();
        });
      }, function originalAggregate(error: unknown) {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.message, 'Original binding operation and postcheck failed');
        assert.deepEqual(error.errors, [operationFailure, postcheckFailure]);
        assert.equal(error.errors[0], operationFailure);
        assert.equal(error.errors[1], postcheckFailure);
        assert.equal(Object.hasOwn(error, 'cause'), false);
        return true;
      });
      assert.equal(f.owner.isBindingSegmentActive(), false);
      f.state.failures.clear();
      assert.throws(function retiredAfterPair() { 
        f.owner.active(); 
      }, { message: 'Original relation evidence lost dependency eligibility', cause: postcheckFailure });
    } });
  }),
] });
//endregion
