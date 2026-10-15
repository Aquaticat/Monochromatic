/**
 Original constructor observations use independent identities and fault controls. @module
 */
import assert from 'node:assert/strict';
import type { ConstructorFixtureInput } from './native-constructor-module-fixture.ts';

/**
 All mutable observations belong to one disposable construction fixture.
 */
type ConstructorFixture = Readonly<{
  events: string[];
  state: {
    clock: number;
    fail?: string;
    onStep?: (point: string) => void;
  };
  options: Record<string, unknown>;
  occurrence: ConstructorFixtureInput;
  controller: AbortController;
  sources: object;
  failure: Error;
}>;

/**
 Construction must never prepare roots, observe files, or send a model request.

 @throws Error when a deferred operation runs during construction
 */
function premature(): never {
  throw new Error('Original preparation capability ran during construction');
}

//region Original callback receivers and occurrence identities are checked before each observation.
/**
 Prepare original inputs without constructing or preparing a judgment.

 @returns independent callback order, identities, and original failure controls

 @example createConstructorFixture();
 */
export function createConstructorFixture(): ConstructorFixture {
  /**
   Observations retain both clock reads and original request handoff order.
   */
  const events: string[] = [];
  /**
   Fault controls are mutable only within this fixture.
   */
  const state: ConstructorFixture['state'] = { clock: 100 };
  /**
   Failure identity is distinct from every generated native diagnostic.
   */
  const failure = new Error('Original constructor observation failed');
  /**
   Original cancellation belongs to this construction occurrence.
   */
  const controller = new AbortController();
  /**
   Source collection remains opaque during initial owner construction.
   */
  const sources = Object.freeze({
    hostGoverningPolicy: {},
    governingSources: []
  });
  /**
   Request receipt contains the exact original source collection.
   */
  const receipt = Object.freeze({
    sources,
    request: { body: 'original request' }
  });
  /**
   Native stream identity is authenticated together with the original response.
   */
  const stream = {};
  /**
   Record original observations and inject an exact callback failure when selected.

   @param point - observable native callback boundary

   @throws Error when the selected observation fails
   */
  function step(point: string): void {
    events.push(point);
    state.onStep?.(point);
    if (state.fail === point) throw failure;
  }
  /**
   Reading content exposes membership capture order without changing the original tool data.
   */
  const response = {
    /** Original content getter exposes the observation before returning native tool values. */
    get content(): readonly object[] {
      step('content');
      return [{
        type: 'toolCall',
        id: 'original-call',
        name: 'read',
        arguments: { path: 'fixture.txt' }
      }];
    },
  };
  /**
   Source handoff and receipt observation retain their original receiver.
   */
  const observer = {
    beginJudgmentSources(value: unknown): Readonly<{ sources: object; request: object }> {
      assert.equal(
        this,
        observer
      );
      assert.equal(
        value,
        response
      );
      step('begin');
      return {
        sources,
        request: receipt
      };
    },
    observationFor(value: unknown): object {
      assert.equal(
        this,
        observer
      );
      assert.equal(
        value,
        response
      );
      step('receipt');
      return receipt;
    },
  };
  /**
   Producer authentication preserves both original occurrence identities.
   */
  const producerOwner = {
    assertMainAgentResponse(input: {
      stream: unknown;
      response: unknown
    }): void {
      assert.equal(
        this,
        producerOwner
      );
      assert.equal(
        input.stream,
        stream
      );
      assert.equal(
        input.response,
        response
      );
      step('producer');
    },
  };
  /**
   Fixed bootstrap options can be replaced later to test capture timing.
   */
  const options: Record<string, unknown> = {
    now() { 
      step('clock');
    return state.clock; 
    },
    producerOwner,
    observer,
    collector: { assertObservedFresh: premature },
    rootAdapter: {
      prepare: premature,
      finalize: premature
    },
    rootDirectory: '/original-constructor-fixture',
    files: [],
    catalogText: 'unused until original preparation',
    catalogSHA256: 'unused until original preparation',
    send: premature,
    isRetryableTransportFailure: premature,
    trace: premature,
  };
  return {
    events,
    state,
    options,
    controller,
    sources,
    failure,
    occurrence: { startedAt: 100, signal: controller.signal, response, stream },
  };
}
//endregion
