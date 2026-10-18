/** Built native constructor retains bootstrap capture, occurrence ordering, and original budget. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { constructorModule } from './native-constructor-module-fixture.ts';
import { createConstructorFixture } from './native-constructor-fixture.ts';
import { publicKeys } from './native-api-keys-fixture.ts';

/** Complete construction observes source ownership before membership and final publication. */
const constructionEvents = ['clock', 'begin', 'producer', 'receipt', 'content', 'content', 'clock'];

//region Construction preserves the original start time and captures fixed bootstrap capabilities once.
await describe({ name: '', children: [
  it({ name: 'captures bootstrap options once and publishes independent original judgments', fn: async function capture() {
    /** Original construction inputs remain available after bootstrap properties are replaced. */
    const fixture = createConstructorFixture();
    /** Factory creation must not invoke any original observation capability. */
    const construct = constructorModule.createJudgmentConstructor(fixture.options);
    assert.deepEqual(fixture.events, []);
    fixture.options.now = function replacedClock(): never { 
      throw new Error('Replaced bootstrap clock used'); 
    };
    fixture.options.observer = {};
    fixture.state.clock = 101;
    /** First original construction consumes the fixed start before later clock observations. */
    const judgment = construct(fixture.occurrence);
    assert.deepEqual(fixture.events, constructionEvents);
    assert.equal(Object.isFrozen(judgment), true);
    assert.deepEqual(Reflect.ownKeys(judgment), publicKeys);
    assert.equal(judgment.readSourceSnapshot(), fixture.sources);
    /** Inert inspection neither reads the clock nor prepares roots. */
    const view = judgment.inspect();
    assert.equal(view.prepared, false);
    assert.equal(view.finished, false);
    assert.deepEqual(view.memberExecutions, []);
    assert.deepEqual(view.childGroups, []);
    assert.equal(view.accounting.startedAt, 100);
    assert.equal(view.accounting.targetAt, 15_100);
    assert.deepEqual(fixture.events, constructionEvents);
    fixture.events.length = 0;
    fixture.state.clock = 201;
    /** Another original occurrence receives independent ownership and its own start time. */
    const another = construct({ ...fixture.occurrence, startedAt: 200 });
    assert.notEqual(another, judgment);
    assert.deepEqual(fixture.events, constructionEvents);
    assert.equal(another.inspect().accounting.startedAt, 200);
    assert.equal(judgment.inspect().accounting.startedAt, 100);
  } }),
  ...['clock', 'begin', 'producer', 'receipt', 'content'].map(function failureCase(point) {
    return it({ name: `retains original ${point} failure before later construction observations`, fn: async function failedConstruction() {
      /** Fault controls apply only to this deferred original occurrence. */
      const fixture = createConstructorFixture();
      /** Fixed factory remains usable after one caller observation fails. */
      const construct = constructorModule.createJudgmentConstructor(fixture.options);
      fixture.state.fail = point;
      assert.throws(function constructFailure() { 
        construct(fixture.occurrence); 
      }, function same(error: unknown) { 
        return error === fixture.failure; 
      });
      assert.deepEqual(fixture.events, constructionEvents.slice(0, constructionEvents.indexOf(point) + 1));
      delete fixture.state.fail;
      fixture.events.length = 0;
      assert.equal(construct(fixture.occurrence).readSourceSnapshot(), fixture.sources);
      assert.deepEqual(fixture.events, constructionEvents);
    } });
  }),
  it({ name: 'rejects initial cancellation before external observations', fn: async function cancelled() {
    /** Cancellation is supplied before original constructor entry. */
    const fixture = createConstructorFixture();
    fixture.controller.abort(fixture.failure);
    /** Factory captures inputs without reading cancellation. */
    const construct = constructorModule.createJudgmentConstructor(fixture.options);
    assert.throws(function constructCancelled() { 
      construct(fixture.occurrence); 
    }, { name: 'JudgmentCancelledError', cause: fixture.failure });
    assert.deepEqual(fixture.events, []);
  } }),
  it({ name: 'allows source handoff beyond the advisory target at final construction checkpoint', fn: async function lateConstruction() {
    /** Source handoff advances the original clock without changing the performance target. */
    const fixture = createConstructorFixture();
    fixture.state.onStep = function expireAfterHandoff(point): void {
      if (point === 'begin') fixture.state.clock = 60_000;
    };
    /** Original timing remains preparation-inclusive across owner assembly. */
    const construct = constructorModule.createJudgmentConstructor(fixture.options);
    /** Late construction retains its original advisory target without retiring evidence. */
    const judgment = construct(fixture.occurrence);
    assert.equal(judgment.inspect().accounting.targetAt, 15_100);
    assert.equal(judgment.inspect().accounting.retired, false);
    assert.deepEqual(fixture.events, constructionEvents);
  } }),
  it({ name: 'retains constructor error identity when original preparation is unavailable', fn: async function unprepared() {
    /** Inert construction does not publish a selection or fabricate member ownership. */
    const fixture = createConstructorFixture();
    /** Original lazy selection remains unavailable until explicit preparation. */
    const judgment = constructorModule.createJudgmentConstructor(fixture.options)(fixture.occurrence);
    assert.throws(function inspectUnprepared() { 
      judgment.inspectBatch({}); 
    }, constructorModule.JudgmentConstructionError);
    assert.deepEqual(fixture.events, constructionEvents);
  } }),
] });
//endregion
