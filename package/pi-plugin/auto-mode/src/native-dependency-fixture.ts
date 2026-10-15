/**
 Original dependency consumer combines a real budget with independent observation capabilities. @module
 */
import assert from 'node:assert/strict';
import { createBudgetFixture } from './native-judgment-budget-fixture.ts';
import {
  dependencyModule,
  type FixtureDependencyChecks,
  type DependencyFixtureState
} from './native-dependency-module-fixture.ts';

/**
 Each mutable boundary can fail or update the next original state read.
 */
type DependencyControls = {
  currentRequest: object;
  onStep?: (point: string) => void;
  readonly failures: Map<string, unknown>;
};

/**
 Fixture-owned observations expose original identity and ordering without sharing state.
 */
type DependencyFixture = ReturnType<typeof createBudgetFixture> & Readonly<{
  owner: FixtureDependencyChecks;
  preparation: DependencyFixtureState;
  state: DependencyControls;
  events: string[];
  receipt: object;
  handle: object;
  liveProjection: object;
  retainedProjection: object;
  finalizeHandles: unknown[];
  retainedHandles: unknown[];
  operation: () => object;
}>;

//region Each original judgment gets independent cancellation, clock, and dependency callbacks.
/**
 Construct original request and prepared program observations around the actual built budget.

 @returns independent dependency owner and exact observation controls

 @example createDependencyFixture();
 */
export function createDependencyFixture(): DependencyFixture {
  /**
   Actual budget supplies original deadline and cancellation semantics.
   */
  const budgetFixture = createBudgetFixture();
  /**
   Original request identity is distinct from every projection.
   */
  const receipt = Object.freeze({});
  /**
   Original dependency handle remains opaque to consumers.
   */
  const handle = Object.freeze({});
  /**
   Successful live and retained results remain distinguishable by identity.
   */
  const liveProjection = Object.freeze({ kind: 'live' });
  /**
   Retained observation is independent of the completed decision clock.
   */
  const retainedProjection = Object.freeze({ kind: 'retained' });
  /**
   Every capability records entry before faults and test-controlled mutations.
   */
  const events: string[] = [];
  /**
   Native facade arguments remain observable without reconstructing a handle.
   */
  const finalizeHandles: unknown[] = [];
  /**
   Retained calls remain separately observable.
   */
  const retainedHandles: unknown[] = [];
  /**
   First-failure tests can throw any original value, including undefined.
   */
  const state: DependencyControls = {
    currentRequest: receipt,
    failures: new Map()
  };
  /**
   Shared state mirrors the original native preparation and closure boundary.
   */
  const preparation: DependencyFixtureState = {
    prepared: true,
    preparationFailed: false,
    finished: false,
    closeFailed: false,
    handle
  };
  /**
   Observe original capability entry before applying a configured effect or failure.

   @param point - current original capability boundary

   @throws original configured failure when selected boundary cannot complete
   */
  function visit(point: string): void {
    events.push(point);
    state.onStep?.(point);
    if (state.failures
      .has(point)) throw state.failures
        .get(point);
  }
  /**
   Run an original caller operation whose failure value crosses the callback boundary.

   @returns original opaque operation result

   @throws configured original operation failure
   */
  function operation(): object {
    visit('operation');
    return handle;
  }
  /**
   Native membership order deliberately differs from alphabetical order.
   */
  const byMember = new Map<string, object>();
  /**
   Prepared source callbacks are the only member fields this owner consumes.
   */
  const bindings = new WeakMap<object, Readonly<{ preparedProgram?: Readonly<{ assertCurrent: () => void }> }>>();
  for (const id of [
    'z',
    'absent',
    'a'
  ]) {
    /**
     Original member identity remains opaque.
     */
    const member = Object.freeze({});
    byMember.set(
      id,
      member
    );
    bindings.set(
      member,
      id === 'absent' ? {} : { preparedProgram: { assertCurrent(): void { 
        visit(`program:${id}`); 
      } } }
    );
  }
  /**
   Independent capability contract proves native owner calls the original boundaries.
   */
  const owner = dependencyModule.createJudgmentDependencyChecks({
    budget: { checkpoint() { 
      visit('checkpoint');
    budgetFixture.budget
      .checkpoint(); 
    } },
    readOriginalRequest() { 
      visit('request');
    return state.currentRequest; 
    },
    receipt,
    facade: {
      finalize(value: unknown) { 
        visit('finalize');
      finalizeHandles.push(value);
      assert.equal(
        value,
        preparation.handle
      );
      return liveProjection; 
      },
      checkRetained(value: unknown) { 
        visit('retained');
      retainedHandles.push(value);
      assert.equal(
        value,
        preparation.handle
      );
      return retainedProjection; 
      },
    },
    byMember,
    bindings,
    trace(event: string) { 
      assert.equal(
      event,
      'binding-segment.postcheck'
    );
    visit('trace'); 
    },
    readPreparation() { 
      visit('state');
    return preparation; 
    },
  });
  return {
    ...budgetFixture,
    owner,
    preparation,
    state,
    events,
    receipt,
    handle,
    liveProjection,
    retainedProjection,
    finalizeHandles,
    retainedHandles
    ,operation
  };
}
//endregion
