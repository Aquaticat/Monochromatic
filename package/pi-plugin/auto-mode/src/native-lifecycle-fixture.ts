/**
 Disposable lifecycle consumers combine actual built selection and transport budgets. @module
 */
import assert from 'node:assert/strict';
import { createBudgetFixture } from './native-judgment-budget-fixture.ts';
import {
  createSelectionFixture,
  createSelectionBinding,
  type FixtureSelection
} from './native-selection-fixture.ts';
import {
  lifecycleModule,
  type FixtureLifecycle,
  type LifecycleAttempt
} from './native-lifecycle-module-fixture.ts';

//region Every lifecycle owns its transport, evidence, dependencies, and fault controls.
/**
 Mutable controls are fixture-owned and never shared between tests.
 */
type LifecycleControls = {
  selection: FixtureSelection;
  readonly failures: Map<string, Error>;
  onStep?: (point: string) => void;
  transport?: (attempt: LifecycleAttempt) => Promise<unknown>;
};

/**
 Consumer fixture keeps actual budget and selection identities inspectable.
 */
type LifecycleFixture = ReturnType<typeof createBudgetFixture> & Readonly<{
  owner: FixtureLifecycle;
  state: LifecycleControls;
  selection: FixtureSelection;
  claim: object;
  events: string[];
  attempts: LifecycleAttempt[];
  handle: object;
  dependencies: object;
}>;

/**
 Construct independent lifecycle capabilities while preserving actual native budget and selection behavior.
 
 @returns disposable consumer and exact fault controls
 
 @example createLifecycleFixture();
 */
export function createLifecycleFixture(): LifecycleFixture {
  /**
   Native accounting supplies real attempt reservation and cleanup.
   */
  const budgetFixture = createBudgetFixture();
  /**
   Native selection supplies original claim, batch, and retained evidence identities.
   */
  const selection = createSelectionFixture();
  /**
   First predicate has one independent original binding.
   */
  const claim = selection.declare({
    definitionId: 'first',
    bindingHandle: createSelectionBinding()
  });
  /**
   Each injected failure is selected by an observable boundary name.
   */
  const state: LifecycleControls = {
    selection,
    failures: new Map()
  };
  /**
   Boundary order is recorded separately from retained result data.
   */
  const events: string[] = [];
  /**
   Transport records exact frozen inputs before returning original answers.
   */
  const attempts: LifecycleAttempt[] = [];
  /**
   Dependency closure consumes the original opaque handle.
   */
  const handle = Object.freeze({});
  /**
   Dependency projection must be retained by identity.
   */
  const dependencies = Object.freeze({ original: true });
  /**
   Record an operation boundary before executing the selected injected behavior.
   
   @param point - exact boundary whose ordering is under test
   
   @throws Error when the fixture selects a failure at this boundary
   */
  function visit(point: string): void {
    events.push(point);
    state.onStep?.(point);
    /**
     Exact injected failures must reach the consumer unchanged.
     */
    const failure = state.failures
      .get(point);
    if (failure !== undefined) throw failure;
  }
  /**
   Original factory receives lazy callbacks; construction must not invoke them.
   */
  const owner = lifecycleModule.createJudgmentLifecycle({
    knownSelection: function knownSelection() { 
      visit('selection');
    return state.selection; 
    },
    ready: function ready() { 
      visit('ready');
    budgetFixture.budget
      .checkpoint(); 
    },
    active: function active() { 
      visit('active');
    budgetFixture.budget
      .checkpoint(); 
    },
    bindingSegment: function bindingSegment<Result>(run: () => Result): Result {
      visit(`segment:${run.name}:enter`);
      /**
       Preserve the exact callback return through the currentness boundary.
       */
      const result = run();
      visit(`segment:${run.name}:exit`);
      return result;
    },
    assertDependenciesCurrent: function assertDependenciesCurrent() { 
      visit('dependencies'); 
    },
    budget: {
      checkpoint: function checkpoint() { 
        visit('checkpoint');
      return budgetFixture.budget
        .checkpoint(); 
      },
      dispatch: async function dispatch(run) { 
        visit('dispatch');
      return await budgetFixture.budget
        .dispatch(run); 
      },
      finish: function finish() { 
        visit('finish');
      return budgetFixture.budget
        .finish(); 
      },
      diagnostics: function diagnostics() { 
        visit('diagnostics');
      return budgetFixture.budget
        .diagnostics(); 
      },
    },
    finalizeDependencies: function finalizeDependencies(original) {
      visit('finalizeDependencies');
      assert.equal(
        original,
        handle
      );
      return dependencies;
    },
    readDependencyHandle: function readDependencyHandle() { 
      visit('dependencyHandle');
    return handle; 
    },
    parentJSON: '{"original":"parent"}',
    send: async function send(attempt) {
      attempts.push(attempt);
      visit('send');
      if (state.transport !== undefined) return await state.transport(attempt);
      return JSON.stringify(attempt.request
        .questions
        .map(function answer(question) {
        return {
          id: question.id,
          status: 'estimate',
          value: 0.75
        };
      }));
    },
  });
  return {
    ...budgetFixture,
    owner,
    state,
    selection,
    claim,
    events,
    attempts,
    handle,
    dependencies
  };
}
//endregion
