/** Built original request handoff preserves authentication order and callback receivers. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';

/** Independent consumer observes arbitrary receipt and failure identities. */
type RequestModule = Readonly<{
  readMainAgentRequest: (input: Readonly<{
    producerOwner: object;
    observer: object;
    stream: object;
    response: object;
  }>) => unknown;
}>;

/**
 Require the built entry before testing original callback order.

 @param value - copied native request module

 @returns assertion exposing independent request consumer contract

 @throws Error when original native request entry is unavailable
 */
function assertRequestModule(value: unknown): asserts value is RequestModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('readMainAgentRequest' in value)))
    throw new Error('Built original request reader is unavailable');
  /** Callable export is observed only after namespace membership is established. */
  const reader = value.readMainAgentRequest;
  if ((typeof reader) !== 'function') throw new Error('Built original request reader is unavailable');
}

/** Native entry delegates to the copied typed request owner. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/request-producer-group-consumer/request.mjs',
  import.meta.url,
).href);
assertRequestModule(loaded);
/** Explicit namespace narrowing remains stable inside test callbacks. */
const requestModule: RequestModule = loaded;

//region Authentication must finish before original observation is even looked up.
await describe({ name: '', children: ['success', 'producer', 'observer'].map(function handoffCase(mode) {
    return it({ name: `preserves original request ${mode} order and identities`, fn: async function requestHandoff() {
      /** Original producer and observer share no synthesized receipt state. */
      const events: string[] = [];
      /** Original stream and response identities cross authentication together. */
      const stream = {};
      /** Response identity must also reach the current observer. */
      const response = {};
      /** Receipt contents remain opaque throughout request handoff. */
      const receipt = Object.freeze({});
      /** Failure identity is shared with the independent observer. */
      const failure = new Error(mode);
      /** Fault controls can recover without constructing a new request reader. */
      const state = { fail: mode };
      /** Producer method lookup and invocation must both precede observer lookup. */
      const producerOwner = {
        get assertMainAgentResponse() {
          events.push('producer.lookup');
          return function authenticate(this: unknown, input: unknown) {
            assert.equal(this, producerOwner);
            assert.deepEqual(input, { stream, response });
            events.push('producer.call');
            if (state.fail === 'producer') throw failure;
          };
        }
      };
      /** Observer method retains its original receiver and exact response argument. */
      const observer = {
        get observationFor() {
          events.push('observer.lookup');
          return function observe(this: unknown, input: unknown) {
            assert.equal(this, observer);
            assert.equal(input, response);
            events.push('observer.call');
            if (state.fail === 'observer') throw failure;
            return receipt;
          };
        }
      };
      /** Unchanged original handoff input can be used again after an external failure clears. */
      const input = { producerOwner, observer, stream, response };
      if (mode === 'success') assert.equal(requestModule.readMainAgentRequest(input), receipt);
      else assert.throws(function failedRead() {
        requestModule.readMainAgentRequest(input);
      }, function same(error: unknown) { return error === failure; });
      assert.deepEqual(events, mode === 'producer'
        ? ['producer.lookup', 'producer.call']
        : ['producer.lookup', 'producer.call', 'observer.lookup', 'observer.call']);
      state.fail = 'success';
      events.length = 0;
      assert.equal(requestModule.readMainAgentRequest(input), receipt);
      assert.deepEqual(events, ['producer.lookup', 'producer.call', 'observer.lookup', 'observer.call']);
    } });
  }) });
//endregion
