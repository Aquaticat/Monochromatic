/**
 Independent source observers expose callback order and original identities. @module
 */
import assert from 'node:assert/strict';
import {
  sourceModule,
  type FixtureSourceOwner
} from './native-source-module-fixture.ts';

/**
 Mutable observations belong to each disposable fixture.
 */
type SourceFixtureState = {
  bindingSources: unknown;
  bindingRequest: unknown;
  bindingResult: unknown;
  failures: Map<string, unknown>;
  onStep?: (point: string) => void;
};

/**
 Test capabilities keep fixture identities distinct from the implementation types.
 */
type SourceFixture = Readonly<{
  events: string[];
  observed: unknown[];
  initial: object;
  fallback: object;
  published: object;
  receipt: object;
  response: object;
  controller: AbortController;
  observer: Record<string, unknown>;
  state: SourceFixtureState;
  construct: () => FixtureSourceOwner;
}>;

//region Deferred construction lets each consumer select its original observer capabilities.
/**
 Create original source capabilities without starting the source handoff.

 @returns independent identities, fault controls, and deferred construction

 @example createSourceFixture();
 */
export function createSourceFixture(): SourceFixture {
  /**
   Every observation is retained in original invocation order.
   */
  const events: string[] = [];
  /**
   Freshness receives the collection identity before callbacks publish replacements.
   */
  const observed: unknown[] = [];
  /**
   Source identities deliberately have equal structure.
   */
  const initial = Object.freeze({});
  /**
   Receipt fallback remains distinct from bound sources.
   */
  const fallback = Object.freeze({});
  /**
   Preparation publishes this distinct original identity.
   */
  const published = Object.freeze({});
  /**
   Handoff receives the exact original response.
   */
  const response = Object.freeze({});
  /**
   Capture requires this signal even when it becomes aborted.
   */
  const controller = new AbortController();
  /**
   Controls belong to this fixture and remain mutable between observations.
   */
  const state: SourceFixtureState = {
    bindingSources: initial,
    bindingRequest: undefined,
    bindingResult: undefined,
    failures: new Map<string, unknown>(),
  };
  /**
   Record and optionally fail one externally supplied operation.

   @param point - original callback boundary

   @throws Error when fixture supplies an original failure
   */
  function step(point: string): void {
    events.push(point);
    state.onStep?.(point);
    if (state.failures.has(point)) throw state.failures.get(point);
  }
  /**
   Fallback observation must remain after original request lookup.
   */
  const receipt = Object.freeze({
    /** Original fallback collection is observed only when bound sources are absent. */
    get sources(): object {
    step('receiptSources'); 
    return fallback; 
  } });
  state.bindingRequest = receipt;
  state.bindingResult = {
    /** Bound source getter records selection before request authentication. */
    get sources(): unknown {
      step('bindingSources'); 
      return state.bindingSources; 
    },
    /** Bound request getter follows source selection. */
    get request(): unknown {
      step('bindingRequest'); 
      return state.bindingRequest; 
    },
  };
  /**
   Native and legacy methods both validate their original receiver and response.
   */
  const observer: Record<string, unknown> = {
    beginJudgmentSources(value: unknown) {
      assert.equal(
        this,
        observer
      );
      assert.equal(
        value,
        response
      );
      step('begin');
      return state.bindingResult;
    },
    bindJudgmentSources(value: unknown) {
      assert.equal(
        this,
        observer
      );
      assert.equal(
        value,
        response
      );
      step('bind');
      return state.bindingResult;
    },
  };
  /**
   Start source ownership only after the test has configured original handoff callbacks.

   @returns built source owner with original fixture capabilities
   */
  function construct(): FixtureSourceOwner {
    return sourceModule.createJudgmentSources({
      observer,
      response,
      signal: controller.signal,
      readOriginalRequest() { 
        step('request'); 
        return receipt; 
      },
      collector: { assertObservedFresh(snapshot: unknown) {
        observed.push(snapshot);
        step('freshness');
      } },
      assertDependenciesCurrent() { 
        step('dependencies'); 
      },
    });
  }
  return {
    events,
    observed,
    initial,
    fallback,
    published,
    receipt,
    response,
    controller,
    observer,
    state,
    construct
  };
}
//endregion
