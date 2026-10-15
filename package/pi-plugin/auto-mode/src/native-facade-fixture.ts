/**
 Independent native dependency capabilities expose original callback order and identity. @module
 */
import assert from 'node:assert/strict';
import {
  facadeModule,
  type FacadeFixtureOwner
} from './native-facade-module-fixture.ts';

/**
 Mutable observations belong to one fixture and never to the built owner.
 */
type FacadeFixture = Readonly<{
  options: Record<string, unknown>;
  events: string[];
  state: {
    now: number;
    fail?: string;
    onStep?: (point: string) => void
  };
  root: object;
  sources: object;
  coverage: object;
  controller: AbortController;
  failure: Error;
  construct: () => FacadeFixtureOwner;
}>;

/**
 Original empty-profile preparation events include every live checkpoint.
 */
export const preparationEvents: readonly string[] = [
  'prepare.entry',
  'clock',
  'prepare.root.enter',
  'root.prepare',
  'prepare.root.return',
  'clock',
  'prepare.collector.enter',
  'capture',
  'prepare.collector.return',
  'clock',
  'clock',
  'prepare.success',
  'clock',
];

/**
 Original empty-profile finalization observes ownership before live dependency callbacks.
 */
export const finalizationEvents: readonly string[] = [
  'finalize.handle-check',
  'finalize.handle-owned',
  'finalize.entry',
  'clock',
  'finalize.root.enter',
  'root.finalize',
  'finalize.root.return',
  'clock',
  'finalize.collector.enter',
  'freshness',
  'finalize.collector.return',
  'clock',
  'coverage',
  'finalize.success',
  'clock',
];

//region Deferred factories let callers select file profiles and original observation failures.
/**
 Create original capabilities whose observable callbacks retain exact receivers and values.

 @returns independent source and root identities, cancellation, and fault controls

 @example createFacadeFixture();
 */
export function createFacadeFixture(): FacadeFixture {
  /**
   Ordered observations include the supplied trace callback and external owners.
   */
  const events: string[] = [];
  /**
   Clock and failure controls remain local to this fixture.
   */
  const state: FacadeFixture['state'] = { now: 100 };
  /**
   Callback failure identity must survive each facade boundary unchanged.
   */
  const failure = new Error('Original dependency observation failed');
  /**
   Every retained record keeps this exact cancellation source.
   */
  const controller = new AbortController();
  /**
   Original root identity remains distinct from every facade handle.
   */
  const root = Object.freeze({});
  /**
   Unqualified coverage retains its original opaque value at projection time.
   */
  const coverage = Object.freeze({});
  /**
   Record a callback before applying the fixture's selected fault.

   @param point - original observable dependency boundary

   @throws Error when the selected original callback fails
   */
  function step(point: string): void {
    events.push(point);
    state.onStep?.(point);
    if (state.fail === point) throw failure;
  }
  /**
   Original coverage access remains observable after dependency revalidation.
   */
  const sources = {
    /**
     Projection reads this original value only after all dependencies were rechecked.
     */
    get unqualifiedCoverage(): object { 
      step('coverage');
    return coverage; 
    },
  };
  /**
   Root callbacks retain their original receiver and opaque capture result.
   */
  const rootAdapter = {
    prepare(): object {
      assert.equal(
        this,
        rootAdapter
      );
      step('root.prepare');
      return root;
    },
    finalize(value: unknown): void {
      assert.equal(
        this,
        rootAdapter
      );
      assert.equal(
        value,
        root
      );
      step('root.finalize');
    },
  };
  /**
   Source callbacks retain the original signal, collection, and method receiver.
   */
  const collector = {
    capture(input: Readonly<{ signal: AbortSignal }>): object {
      assert.equal(
        this,
        collector
      );
      assert.equal(
        input.signal,
        controller.signal
      );
      step('capture');
      return sources;
    },
    assertObservedFresh(value: unknown): void {
      assert.equal(
        this,
        collector
      );
      assert.equal(
        value,
        sources
      );
      step('freshness');
    },
  };
  /**
   Original empty profile needs no filesystem reads before explicit test configuration.
   */
  const options: Record<string, unknown> = {
    rootAdapter,
    collector,
    rootDirectory: '/declared-dependency-fixture',
    files: [],
    deadlineAt: 200,
    now() { 
      step('clock'); 
      return state.now; 
    },
    trace(point: string) { 
      step(point); 
    },
  };
  /**
   Construct only after the caller has selected its declared profile.

   @returns original built facade sharing these independent capabilities
   */
  function construct(): FacadeFixtureOwner { 
    return facadeModule.createDependencyFacade(options); 
  }
  return {
    options,
    events,
    state,
    root,
    sources,
    coverage,
    controller,
    failure,
    construct
  };
}
//endregion
