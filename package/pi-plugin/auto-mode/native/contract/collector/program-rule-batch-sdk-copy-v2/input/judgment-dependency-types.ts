/**
 Original dependency eligibility and binding lifetime contracts. @module
 */
import type { JudgmentBudget } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { ProgramMemberRecord } from './program-state-types.ts';
import type { JudgmentPreparationState } from './judgment-preparation-types.ts';

/**
 Shared preparation and closure values are read only at original operation boundaries.
 */
export type JudgmentDependencyState = Readonly<{
  prepared: boolean;
  preparationFailed: boolean;
  preparationFailure: unknown;
  finished: boolean;
  closeFailed: boolean;
  finalRecord?: Partial<Readonly<{
    record: Readonly<{
      failure?: unknown;
      status?: 'evidence-closed' | 'close-failed'
    }>;
  }>>['record'];
  handle?: JudgmentPreparationState['handle'];
}>;

/**
 First dependency failure remains retained after later callbacks fail differently.
 */
export type JudgmentDependencyRetained = {
  eligibilityFailure?: Readonly<{ cause: unknown }>;
  bindingSegmentActive: boolean;
};

/**
 Original observation capabilities remain lazy and retain their own native owner.
 */
export type JudgmentDependencyInput = Readonly<{
  budget: Pick<JudgmentBudget, 'checkpoint'>;
  readOriginalRequest: () => object;
  receipt: object;
  facade: Readonly<{
    finalize: (handle: JudgmentDependencyState['handle']) => unknown;
    checkRetained: (handle: JudgmentDependencyState['handle']) => unknown;
  }>;
  byMember: ReadonlyMap<string, object>;
  bindings: Pick<WeakMap<object, ProgramMemberRecord>, 'get'>;
  trace: (event: string) => void;
  readPreparation: () => JudgmentDependencyState;
}>;

/**
 Synchronous dependency boundaries preserve values while retaining original failures.
 */
export type JudgmentDependencyChecks = Readonly<{
  active: () => void;
  ready: () => void;
  dependencyCheck: <Result>(read: () => Result) => Result;
  bindingSegment: <Result>(run: () => Result) => Result;
  assertDependenciesCurrent: () => unknown;
  isBindingSegmentActive: () => boolean;
}>;
