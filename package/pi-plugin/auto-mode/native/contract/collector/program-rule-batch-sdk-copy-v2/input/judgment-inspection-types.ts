/**
 Original judgment inspection distinguishes live member reads from retained lifecycle diagnostics. @module
 */
import type { JudgmentBudget } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { JudgmentPreparationState } from './judgment-preparation-types.ts';
import type { JudgmentLifecycleState } from './judgment-lifecycle-types.ts';
import type {
  ProgramMemberRecord,
  ProgramGroup
} from './program-state-types.ts';
import type { PreparedProgramView } from './program-declaration-types.ts';
import type {
  PreparedProgramLookup,
  ProgramInspection
} from './program-api.ts';

/**
 Current prepared-member reads preserve original data, cancellation, and optional source inspection.
 */
export type JudgmentPreparedMemberView = Readonly<{
  prepared: ProgramMemberRecord['prepared'];
  signal: AbortSignal;
  programInspection: PreparedProgramLookup;
}>;

/**
 Original execution diagnostics retain declaration order and unentered membership.
 */
export type JudgmentMemberExecutionView = Readonly<{
  id: string;
  state: 'unentered' | 'active' | 'returned';
}>;

/**
 Retained inspection never asserts that original evidence or execution remains eligible.
 */
export type JudgmentInspectionView = Readonly<{
  prepared: boolean;
  preparationFailed: boolean;
  preparationFailure: unknown;
  finished: boolean;
  closeFailed: boolean;
  accounting: ReturnType<JudgmentBudget['diagnostics']>;
  finalRecord: JudgmentLifecycleState['finalRecord'];
  memberExecutions: readonly JudgmentMemberExecutionView[];
  preparedPrograms: readonly PreparedProgramView[];
  rootPrograms: readonly ReturnType<ProgramInspection['inspectProgram']>[];
  childGroups: readonly ReturnType<ProgramInspection['inspectReachedGroup']>[];
}>;

/**
 Shared owners supply original member records and current versus retained access boundaries.
 */
export type JudgmentInspectionInput = Readonly<{
  preparation: JudgmentPreparationState;
  lifecycle: JudgmentLifecycleState;
  budget: Pick<JudgmentBudget, 'diagnostics'>;
  byMember: ReadonlyMap<string, object>;
  bindings: Pick<WeakMap<object, ProgramMemberRecord>, 'get'>;
  childGroups: readonly ProgramGroup[];
  knownMember: (member: unknown) => ProgramMemberRecord;
  assertDependenciesCurrent: () => void;
  parentCurrent: (record: ProgramMemberRecord) => void;
  ready: () => void;
  originalFile: (input: Readonly<{
    handle: JudgmentPreparationState['handle'];
    absolutePath: unknown;
  }>) => unknown;
  inspectProgram: ProgramInspection['inspectProgram'];
  inspectReachedGroup: ProgramInspection['inspectReachedGroup'];
}>;

/**
 Live reads and retained diagnostics preserve their separate original access requirements.
 */
export type JudgmentInspection = Readonly<{
  preparedMemberFor: (member: unknown) => JudgmentPreparedMemberView;
  originalFileFor: (member: unknown) => unknown;
  inspect: () => JudgmentInspectionView;
}>;
