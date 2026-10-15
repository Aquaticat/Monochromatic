/** Built public judgment retains direct owner identity and lazy selection inspection. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createAPIFixture } from './native-api-fixture.ts';
import { directKeys, selectionKeys } from './native-api-keys-fixture.ts';

//region Direct native and retained methods preserve original callbacks and receivers.
await describe({ name: '', children: [
  ...directKeys.map(function directCase(name) {
    return it({ name: `retains direct ${name} identity, receiver, arguments, and failure`, fn: async function directInvocation() {
      /** Operation failures must never affect a direct public method. */
      const f = createAPIFixture();
      f.failures.set('operation:before', new Error('unexpected guard'));
      f.failures.set('selection', new Error('unexpected selection'));
      /** Direct owner is captured before later changes to the assembly input. */
      const original = f.input[name];
      /** Built surface is frozen without wrapping original direct functions. */
      const api = f.construct();
      /** Published method remains the exact original function. */
      const method = f.method({ name, api });
      assert.equal(method, original);
      f.input[name] = function replacement() { throw new Error('unexpected replacement'); };
      /** Original direct invocation preserves arbitrary caller receiver. */
      const receiver = {};
      /** Full argument lists remain visible to original direct methods. */
      const args = [{}, {}, {}];
      assert.equal(Reflect.apply(method, receiver, args), f.results.get(name));
      assert.deepEqual(f.calls, [{ name, args, receiver }]);
      assert.deepEqual(f.events, [name]);
      assert.deepEqual(f.guarded, []);
      /** Direct asynchronous result identity cannot change through assembly. */
      const asynchronous = Promise.resolve({});
      f.results.set(name, asynchronous);
      assert.equal(method(), asynchronous);
      f.results.set(name, undefined);
      assert.equal(method(), undefined);
      /** Direct failures retain exact identity and remain independently recoverable. */
      const failure = new Error(name);
      f.failures.set(name, failure);
      assert.throws(function failedDirect() { method(); }, function same(error: unknown) { return error === failure; });
      f.failures.delete(name);
      assert.equal(method(), undefined);
    } });
  }),
  ...selectionKeys.map(function selectionCase(name) {
    return it({ name: `resolves current selection lazily for ${name} and preserves its receiver`, fn: async function selectionInvocation() {
      /** Selection retrieval is distinct from the synchronous operation guard. */
      const f = createAPIFixture();
      f.failures.set('operation:before', new Error('unexpected operation'));
      /** No selection is read until a retained inspection is invoked. */
      const api = f.construct();
      assert.deepEqual(f.events, []);
      /** Public selection wrapper captures the original resolver without binding a selection early. */
      const method = f.method({ name, api });
      f.input.knownSelection = function replacementResolver() { throw new Error('unexpected replacement resolver'); };
      /** Original opaque inspection argument must be passed once. */
      const subject = {};
      for (const args of [[], [subject], [subject, {}]]) {
        f.events.length = 0;
        f.calls.length = 0;
        assert.equal(Reflect.apply(method, {}, args), f.results.get(name));
        assert.deepEqual(f.events, ['selection', name]);
        assert.deepEqual(f.calls, [{ name, args: [args[0]], receiver: f.state.selection }]);
      }
      /** A later selection can expose a getter-backed method without changing assembly. */
      const originalMethod = f.state.selection[name];
      /** Getter access must follow resolution and retain the replacement object's receiver. */
      const replacement = {
        get inspectBatch() { f.events.push('lookup'); return originalMethod; },
        get inspectClaim() { f.events.push('lookup'); return originalMethod; },
      };
      f.state.selection = replacement;
      f.events.length = 0;
      f.calls.length = 0;
      assert.equal(method(subject), f.results.get(name));
      assert.deepEqual(f.events, ['selection', 'lookup', name]);
      assert.equal(f.calls[0]?.receiver, replacement);
      /** Resolver and method failures stop at their own original boundary. */
      for (const boundary of ['selection', name]) {
        /** The original failure must survive both stages of lazy dispatch. */
        const failure = new Error(boundary);
        f.failures.set(boundary, failure);
        f.events.length = 0;
        assert.throws(function failedInspection() { method(subject); }, function same(error: unknown) { return error === failure; });
        assert.deepEqual(f.events, boundary === 'selection' ? ['selection'] : ['selection', 'lookup', name]);
        f.failures.delete(boundary);
      }
      assert.equal(method(subject), f.results.get(name));
      assert.deepEqual(f.guarded, []);
    } });
  }),
] });
//endregion
