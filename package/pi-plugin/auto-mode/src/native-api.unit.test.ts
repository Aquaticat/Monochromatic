/** Built public judgment assembly preserves every guarded call boundary. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createAPIFixture } from './native-api-fixture.ts';
import { oneInputKeys, noInputKeys, publicKeys } from './native-api-keys-fixture.ts';

//region Public publication and all guarded owner invocations retain original call semantics.
await describe({ name: '', children: [
  it({ name: 'publishes exactly the original frozen public keys without invoking owners', fn: async function publication() {
    /** Every owner is configured to fail if assembly tries to invoke it. */
    const f = createAPIFixture();
    for (const name of [...publicKeys, 'selection', 'active', 'operation:before'])
      f.failures.set(name, new Error(name));
    /** Assembly performs no live observations. */
    const api = f.construct();
    assert.deepEqual(Reflect.ownKeys(api), publicKeys);
    assert.ok(Object.isFrozen(api));
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.guarded, []);
  } }),
  ...[...oneInputKeys, ...noInputKeys].map(function guardedCase(name) {
    return it({ name: `retains ${name} callback, arguments, result, and failure boundaries`, fn: async function guardedInvocation() {
      /** Instrumentation records each phase without validating argument shape. */
      const f = createAPIFixture();
      /** Public checkpoint uses the original active callback. */
      const ownerName = name === 'checkpoint' ? 'active' : name;
      /** No-input operations pass their original callback directly into the guard. */
      const noInput = noInputKeys.some(function match(key) { 
        return key === name; 
      });
      /** Original owner identity is captured at assembly time. */
      const original = f.input[ownerName];
      /** The built public method is exercised as a foreign caller would invoke it. */
      const api = f.construct();
      /** Independently selected callback can receive any runtime arguments. */
      const method = f.method({ name, api });
      assert.notEqual(method, original);
      f.input[ownerName] = function replacedOwner() { 
        throw new Error('replacement must remain unobserved'); 
      };
      /** Arbitrary caller receiver must not leak into guarded owners. */
      const receiver = {};
      /** Opaque arguments distinguish forwarding from copying and extra-argument spreading. */
      const first = {};
      /** Extra argument remains invisible to original guarded owners. */
      const extra = {};
      for (const args of [[], [first], [first, extra]]) {
        f.events.length = 0;
        f.calls.length = 0;
        f.guarded.length = 0;
        assert.equal(Reflect.apply(method, receiver, args), f.results.get(ownerName));
        assert.deepEqual(f.events, ['operation:before', ownerName, 'operation:after']);
        assert.deepEqual(f.calls, [{ name: ownerName, args: noInput ? [] : [args[0]], receiver: undefined }]);
        assert.equal(f.guarded.length, 1);
        if (noInput) assert.equal(f.guarded[0], original);
        else assert.notEqual(f.guarded[0], original);
      }
      /** Guard result remains authoritative even when distinct from the owner result. */
      const guardResult = {};
      f.results.set('operation', guardResult);
      assert.equal(method(first), guardResult);
      f.results.delete('operation');
      f.results.set(ownerName, undefined);
      assert.equal(method(first), undefined);
      /** Synchronous wrappers must preserve thenable identity without adding an async boundary. */
      const asynchronous = Promise.resolve(first);
      f.results.set(ownerName, asynchronous);
      assert.equal(method(first), asynchronous);
      for (const boundary of ['operation:before', ownerName, 'operation:after']) {
        /** Exact failure must cross assembly without wrapping or retaining it. */
        const failure = new Error(boundary);
        f.failures.set(boundary, failure);
        f.events.length = 0;
        assert.throws(function failedOwner() { 
          method(first); 
        }, function same(error: unknown) { 
          return error === failure; 
        });
        /** Later phases must not run after the injected failure. */
        const phases = ['operation:before', ownerName, 'operation:after'];
        assert.deepEqual(f.events, phases.slice(0, phases.indexOf(boundary) + 1));
        f.failures.clear();
        assert.equal(method(first), asynchronous);
      }
    } });
  }),
] });
//endregion
