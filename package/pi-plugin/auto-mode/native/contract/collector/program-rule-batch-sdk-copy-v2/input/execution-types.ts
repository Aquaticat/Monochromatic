/**
 Original native execution contracts keep evidence closure separate from execution permission. @module
 */
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type { ProgramMemberRecord, ProgramExecutionRecord } from './program-state-types.ts';

/**
 Original entry identities remain inspectable without implying permission to execute.
 */
export type JudgmentExecutionOrigin = Readonly<{
  judgment: object;
  response: object;
  stream: object;
  signal: AbortSignal;
  member: object;
  prepared: ProgramPreparedMember;
  permission: 'not-established';
}>;

/**
 Captured capabilities share the judgment's original member records and closure phase.
 */
export type JudgmentExecutionInput = Readonly<{
  bindings: WeakMap<object, ProgramMemberRecord>;
  byMember: ReadonlyMap<string, object>;
  readClosure: () => Readonly<{ finished: boolean; closeFailed: boolean }>;
  readJudgment: () => object;
  response: object;
  stream: object;
  assertDependenciesCurrent: () => void;
}>;

/**
 Authenticated readers return original records before phase-specific eligibility checks.
 */
export type JudgmentExecutionOwnership = Readonly<{
  knownMember: (member: object) => ProgramMemberRecord;
  knownExecution: (token: object) => ProgramExecutionRecord;
  parentCurrent: (record: ProgramMemberRecord) => void;
  memberFor: (id: string) => object;
}>;

/**
 Shared private execution map is populated only after original entry reservation succeeds.
 */
export type JudgmentExecutionContext = Readonly<{
  input: JudgmentExecutionInput;
  executions: WeakMap<object, ProgramMemberRecord>;
}>;
