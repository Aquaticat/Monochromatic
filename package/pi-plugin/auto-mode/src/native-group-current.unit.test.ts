/** Original currentness ordering prevents post-callback state from being mistaken for an earlier snapshot. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createCurrentFixture } from './native-group-current-fixture.ts';

//region Original failure and cancellation precedence surround the original callback pair.
await describe({ name: '', children: [
  it({ name: 'reads original parent and view each time without advancing collection state', fn: async function current() {
    /** Binding the factory is inert until a consumer requests currentness. */
    const f = createCurrentFixture();
    assert.equal(f.events.length, 0);
    f.owner.current();
    f.owner.current();
    assert.deepEqual(f.events, ['parent', 'read', 'parent', 'read']);
    assert.equal(f.state.phase, 'collecting');
    assert.equal(f.state.closed, false);
    assert.equal(f.recorded.length, 0);
    assert.equal(f.aborted.length, 0);
  } }),
  it({ name: 'retained primary precedes closure and cancellation before any original callbacks', fn: async function primary() {
    /** Every conflicting terminal condition is present so precedence is observable. */
    const f = createCurrentFixture();
    f.state.primary = f.recordedToken;
    f.state.closed = true;
    f.controller.abort('original');
    assert.throws(function current() { 
      f.owner.current(); 
    }, function same(error: unknown) { 
      return error === f.recordedToken; 
    });
    assert.equal(f.events.length, 0);
  } }),
  it({ name: 'closure precedes cancellation and reports the original category and message', fn: async function closed() {
    /** Closure is checked before any cancellation occurrence is observed. */
    const f = createCurrentFixture();
    f.state.closed = true;
    f.controller.abort('original');
    assert.throws(function current() { 
      f.owner.current(); 
    }, { name: 'DeclaredGroupCollectionError', message: 'Declared parent group has returned' });
    assert.equal(f.events.length, 0);
  } }),
  it({ name: 'initial parent cancellation retains its original signal before reading currentness', fn: async function aborted() {
    /** Initial cancellation stops before either original parent callback. */
    const f = createCurrentFixture();
    f.controller.abort('original');
    assert.throws(function current() { 
      f.owner.current(); 
    }, function same(error: unknown) { 
      return error === f.abortedToken; 
    });
    assert.deepEqual(f.events, ['abort']);
    assert.equal(f.aborted[0]?.observed, f.controller.signal);
    assert.equal(f.aborted[0]?.at, 'original-cancellation');
  } }),
  ...['parent', 'read'].flatMap(function boundaries(point) {
    return ['primary', 'closed', 'abort'].map(function publications(publication) {
      return it({ name: `rechecks ${publication} published by original ${point} callback`, fn: async function changed() {
        /** Original callbacks may publish new state after initial currentness checks. */
        const f = createCurrentFixture();
        f.state.mutateAt = point;
        f.state.mutate = function publish(): void {
          if (publication === 'primary') f.state.primary = f.recordedToken;
          else if (publication === 'closed') f.state.closed = true;
          else {
            f.state.primary = f.recordedToken;
            f.state.closed = true;
            f.controller.abort('original');
          }
        };
        if (publication === 'closed') assert.throws(function current() { 
          f.owner.current(); 
        }, { name: 'DeclaredGroupCollectionError', message: 'Declared parent group has returned' });
        else assert.throws(function current() { 
          f.owner.current(); 
        }, function same(error: unknown) { 
          return error === (publication === 'abort' ? f.abortedToken : f.recordedToken); 
        });
        assert.deepEqual(f.events, publication === 'abort' ? ['parent', 'read', 'abort'] : ['parent', 'read']);
        assert.equal(f.recorded.length, 0);
      } });
    });
  }),
  ...['parent', 'read'].map(function boundaries(point) {
    return it({ name: `retains exact original ${point} callback failures and recovers on the next read`, fn: async function failure() {
      /** Opaque callback throws become original failure occurrences without replacement. */
      const f = createCurrentFixture();
      f.state.failAt = point;
      f.state.failure = undefined;
      assert.throws(function current() { 
        f.owner.current(); 
      }, function same(error: unknown) { 
        return error === f.recordedToken; 
      });
      assert.deepEqual(f.events, point === 'parent' ? ['parent', 'record'] : ['parent', 'read', 'record']);
      assert.equal(f.recorded[0]?.error, undefined);
      assert.equal(f.recorded[0]?.at, 'parent-current-reader');
      delete f.state.failAt;
      f.owner.current();
      assert.deepEqual(f.events.slice(-2), ['parent', 'read']);
    } });
  }),
  it({ name: 'records original reached-view identity mismatch and propagates failure-recorder exceptions', fn: async function view() {
    /** Equal-shaped replacement views cannot substitute for original reached identity. */
    const f = createCurrentFixture();
    f.state.view = Object.freeze({ original: 'view' });
    assert.throws(function current() { 
      f.owner.current(); 
    }, function same(error: unknown) { 
      return error === f.recordedToken; 
    });
    /** Mismatch diagnostic must retain its original category and message. */
    const recorded = f.recorded[0]?.error;
    assert.ok(Error.isError(recorded,));
    assert.equal(recorded.name, 'DeclaredGroupCollectionError');
    assert.equal(recorded.message, 'Reached group view changed during native collection');
    assert.deepEqual(f.events, ['parent', 'read', 'record']);
    f.state.failAt = 'record';
    assert.throws(function current() { 
      f.owner.current(); 
    }, function same(error: unknown) { 
      return error === f.state.failure; 
    });
  } }),
] });
//endregion
