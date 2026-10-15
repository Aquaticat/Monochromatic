/** Declared program consumers retain exact original capabilities and source association. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerFacadeFixture } from './native-runner-facade-fixture.ts';

await describe({ name: '', children: [
  //region Construction retains original declaration checks and capability identities.
  it({ name: 'opens original program once and freezes a shallow original runtime facade', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const run = fixture.create();
    const input = fixture.runtimeInput();
    assert.deepEqual(fixture.steps, ['parent', 'open', 'runtime']);
    assert.deepEqual(fixture.observations, [['open', { parentToken: fixture.input.carrier.token, toolNames: ['first', 'first', 'last'] }]]);
    assert.equal(input.judgment, fixture.input.origin.judgment);
    assert.equal(input.program, fixture.program);
    assert.equal(input.signal, fixture.input.origin.signal);
    assert.equal(input.assertParentCurrent, fixture.input.assertParentCurrent);
    assert.ok(Object.isFrozen(run));
    assert.notEqual(run, fixture.runtime);
    assert.equal(run.declaration, fixture.runtime.declaration);
    assert.equal(run.tools, fixture.runtime.tools);
    assert.equal(run.inspect, fixture.runtime.inspect);
    assert.equal(run.retire, fixture.runtime.retire);
    assert.equal(run.valueFor, fixture.runtime.valueFor);
    assert.notEqual(run.drain, fixture.runtime.drain);
    assert.equal(run.inspect(), fixture.value);
    run.retire();
    await run.drain();
    await run.drain();
    assert.deepEqual(fixture.steps.slice(-4), ['inspect', 'retire', 'drain', 'drain']);
  } }),
  ...[undefined, null, {}, Object.freeze({ length: 0 }), []].map(function invalidTools(tools) {
    return it({ name: `rejects unavailable original tool snapshot ${String(tools)}`, fn: async () => {
      const fixture = createRunnerFacadeFixture();
      fixture.input.tools = tools;
      assert.throws(fixture.create, { message: 'Original request tool snapshot is unavailable' });
      assert.deepEqual(fixture.steps, []);
    } });
  }),
  it({ name: 'checks original parent before source equality and opening', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    fixture.input.code = 'different source';
    assert.throws(fixture.create, { message: 'Declared program differs from original prepared input' });
    assert.deepEqual(fixture.steps, ['parent']);
  } }),
  ...['parent', 'open', 'runtime'].map(function failedConstruction(point) {
    return it({ name: `retains original ${point} construction failure without later callbacks`, fn: async () => {
      const fixture = createRunnerFacadeFixture();
      fixture.control.failAt = point;
      assert.throws(fixture.create, function original(error) { 
        return error === fixture.control.failure; 
      });
      assert.equal(fixture.steps.at(-1), point);
    } });
  }),
  //endregion
  //region Native association is published before original execution can request script conversion.
  it({ name: 'binds exact original group and publishes original slots before starting execution', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const run = fixture.create();
    const input = fixture.runtimeInput();
    const group = { handle: Object.freeze({ original: 'group' }) };
    const outcome = Object.freeze({ original: 'outcome' });
    fixture.control.onStep = function atExecution(point) {
      if (point === 'execute') assert.equal(input.scriptValueFor({ group: group.handle, ordinal: 1, outcome }), fixture.value);
    };
    const {dispatchGroup} = input;
    const promises = dispatchGroup(group);
    assert.equal(promises[0], fixture.bound.tickets[0]?.promise);
    assert.equal(promises[1], fixture.bound.tickets[1]?.promise);
    assert.deepEqual(fixture.steps, ['parent', 'open', 'runtime', 'bind', 'execute', 'convert']);
    assert.deepEqual(fixture.observations[1], ['bind', { tools: fixture.input.tools, origin: fixture.input.origin, carrier: fixture.input.carrier, group, assertParentCurrent: fixture.input.assertParentCurrent }]);
    assert.deepEqual(fixture.observations[2], ['execute', { origin: fixture.input.origin, program: fixture.program, group, bound: fixture.bound, assertParentCurrent: fixture.input.assertParentCurrent }]);
    assert.deepEqual(fixture.observations[3], ['convert', { group: group.handle, slot: fixture.bound.slots[1], outcome }]);
    await run.drain();
    assert.throws(function missingGroup() { 
      input.scriptValueFor({ group: {}, ordinal: 0, outcome }); 
    }, { message: 'Native group has no owned result slots' });
    fixture.control.failAt = 'convert';
    assert.throws(function failedConversion() { 
      input.scriptValueFor({ group: group.handle, ordinal: 0, outcome }); 
    }, function original(error) { 
      return error === fixture.control.failure; 
    });
  } }),
  it({ name: 'retains originally captured judgment after opening replaces parent judgment', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const {judgment} = fixture.input.origin;
    fixture.control.onStep = function replaceAtOpen(point) {
      if (point !== 'open') return;
      fixture.input.origin.judgment = { openProgram(): never { 
        throw new Error('replacement used'); 
      }, scriptValueFor(): never { 
        throw new Error('replacement used'); 
      } };
    };
    const run = fixture.create();
    const input = fixture.runtimeInput();
    assert.equal(input.judgment, judgment);
    const group = { handle: {} };
    input.dispatchGroup(group);
    assert.equal(input.scriptValueFor({ group: group.handle, ordinal: 0, outcome: undefined }), fixture.value);
    await run.drain();
  } }),
  it({ name: 'binding failure remains synchronous and publishes neither native work nor slots', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const run = fixture.create();
    const input = fixture.runtimeInput();
    const group = { handle: {} };
    fixture.control.failAt = 'bind';
    assert.throws(function dispatch() { 
      input.dispatchGroup(group); 
    }, function original(error) { 
      return error === fixture.control.failure; 
    });
    assert.deepEqual(fixture.steps.slice(-1), ['bind']);
    assert.throws(function value() { 
      input.scriptValueFor({ group: group.handle, ordinal: 0, outcome: null }); 
    }, { message: 'Native group has no owned result slots' });
    await run.drain();
  } }),
  //endregion
] });
