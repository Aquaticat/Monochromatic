/** Original native wrappers copy metadata while retaining execution context and argument identity. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createExecutableFixture } from './native-prepared-executable-fixture.ts';

await describe({ name: 'prepared native wrappers', children: [
  //region Tool snapshots preserve object-spread observations and original execution ownership.
  it({ name: 'copies enumerable metadata once and retains original native definition and input identity', fn: async function nativeIdentity() {
    const fixture = createExecutableFixture();
    const symbol = Symbol('metadata copied from the original native tool');
    const reads: string[] = [];
    const inherited: unknown = Object.create({ inherited: true });
    Object.defineProperties(inherited, {
      name: { value: 'tool', enumerable: true },
      label: { get() { 
        reads.push('label');
      return 'original label'; 
      }, enumerable: true },
      hidden: { value: true },
      execute: { get() { 
        reads.push('execute');
      return 'replaced callback'; 
      }, enumerable: true },
      [symbol]: { value: fixture.original, enumerable: true },
    });
    const [tool] = fixture.wrap({ tools: [inherited] });
    assert.ok(tool);
    assert.notEqual(tool, inherited);
    assert.equal(tool.label, 'original label');
    assert.equal(tool[symbol], fixture.original);
    assert.equal(Object.hasOwn(tool, 'hidden'), false);
    assert.equal(Object.hasOwn(tool, 'inherited'), false);
    assert.deepEqual(reads, ['label', 'execute']);
    const params = { value: true };
    const {signal} = new AbortController();
    const onUpdate = Object.freeze({ opaque: 'native callback' });
    assert.equal(await tool.execute('one', params, signal, onUpdate), 'native result');
    const [invocation] = fixture.invocations;
    assert.ok(invocation);
    assert.equal(invocation.tool, inherited);
    assert.equal(invocation.judgment, fixture.judgment);
    assert.deepEqual(invocation.args, ['one', params, signal, onUpdate]);
    assert.equal(invocation.args[1], params);
    assert.equal(invocation.args[2], signal);
    assert.equal(invocation.args[3], onUpdate);
    assert.equal(Object.isFrozen(invocation.args), false);
    assert.deepEqual(fixture.events, ['member-execute', 'execute']);
  } }),
  it({ name: 'retains sparse metadata groups and primitive object-spread behavior', fn: async function primitiveSpread() {
    const fixture = createExecutableFixture();
    const source: unknown[] = [];
    source.length = 1;
    assert.equal(Object.hasOwn(fixture.wrap({ tools: source }), '0'), false);
    const wrappers = fixture.wrap({ tools: ['ab', null, undefined] });
    assert.equal(wrappers[0]?.[0], 'a');
    assert.equal(wrappers[0]?.[1], 'b');
    await Promise.all(wrappers.map(async function executePrimitive(wrapper) {
      assert.equal(await wrapper.execute('one'), 'native result');
    }));
    assert.deepEqual(fixture.invocations.map(function original(input) { 
      return input.tool; 
    }), ['ab', null, undefined]);
  } }),
  it({ name: 'preserves opaque source getter failures during wrapper construction', fn: async function metadataFailure() {
    const fixture = createExecutableFixture();
    const failure: unknown = Object.freeze({ reason: 'native metadata getter' });
    assert.throws(function construct() {
      fixture.wrap({ tools: [{ get label() { 
        throw failure; 
      } }] });
    }, function sameFailure(error: unknown) { 
      return error === failure; 
    });
    assert.deepEqual(fixture.events, []);
  } }),
  it({ name: 'retained execution callbacks do not reread the returned wrapper property', fn: async function retainedCallback() {
    const fixture = createExecutableFixture();
    const [tool] = fixture.wrap();
    assert.ok(tool);
    const callback = tool.execute;
    Object.defineProperty(tool, 'execute', { get() {
      throw new Error('Retained callback read a replaced wrapper property');
    } });
    assert.equal(await callback('one'), 'native result');
  } }),
  //endregion
  //region Serial execution awaits the original indexed turn before checking currentness.
  it({ name: 'waits for the selected original turn before active admission and native execution', fn: async function serialTurn() {
    const fixture = createExecutableFixture();
    const turn = Promise.withResolvers<void>();
    fixture.control.waitForTurn = function waitForTurn(ordinal) {
      assert.equal(ordinal, 1);
      return turn.promise;
    };
    const [tool] = fixture.wrap({ serial: true });
    assert.ok(tool);
    const pending = tool.execute('two');
    assert.equal(await Promise.race([pending, setImmediate('pending')]), 'pending');
    assert.deepEqual(fixture.events, ['turn:1']);
    turn.resolve();
    assert.equal(await pending, 'native result');
    assert.deepEqual(fixture.events, ['turn:1', 'member-execute', 'execute']);
  } }),
  it({ name: 'parallel execution bypasses turn lookup and assimilates native asynchronous results', fn: async function parallelTurn() {
    const fixture = createExecutableFixture();
    const native = Promise.withResolvers<unknown>();
    fixture.control.waitForTurn = function unexpectedTurn() { 
      throw new Error('Parallel execution read a turn'); 
    };
    fixture.control.execute = function execute() { 
      return native.promise; 
    };
    const [tool] = fixture.wrap();
    assert.ok(tool);
    const pending = tool.execute('one');
    assert.equal(await Promise.race([pending, setImmediate('pending')]), 'pending');
    const result = Object.freeze({ original: 'asynchronous native result' });
    native.resolve(result);
    assert.equal(await pending, result);
    assert.deepEqual(fixture.events, ['member-execute', 'execute']);
  } }),
  it({ name: 'does not await the original synchronous currentness callback result', fn: async function activeResult() {
    const fixture = createExecutableFixture();
    const active = Promise.withResolvers<void>();
    fixture.control.active = function current() { 
      return active.promise; 
    };
    const [tool] = fixture.wrap();
    assert.ok(tool);
    assert.equal(await Promise.race([tool.execute('one'), setImmediate('pending')]), 'native result');
    active.resolve();
  } }),
  //endregion
] });
