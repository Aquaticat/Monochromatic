/**
 Native execution custody authenticates opaque occurrences independently of current dependencies. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import type { OriginalMembershipRead } from './membership-read.ts';
import type {
  ProgramMemberRecord,
  ProgramExecutionRecord
} from './program-state-types.ts';
import type {
  JudgmentExecutionContext,
  JudgmentExecutionOwnership
} from './execution-types.ts';

/**
 Narrow records populated exclusively by the original execution reservation boundary.

 @param record - original member record retained by execution custody

 @returns whether original reservation published its execution
 */
function hasExecution(record: ProgramMemberRecord): record is ProgramExecutionRecord {
  return record.execution !== undefined;
}

//region Identity custody precedes phase and dependency checks at every execution boundary.
/**
 Retain original member and execution identity checks without invoking dependency readers at construction.

 @param input - captured original judgment capabilities

 @param executions - private original execution custody

 @returns original member, execution, and immediate-parent readers

 @example createExecutionOwnership({ input, executions });
 */
export function createExecutionOwnership({
  input,
  executions
}: JudgmentExecutionContext): JudgmentExecutionOwnership {
  /**
   Original membership records are shared with prepared-program publication.
   */
  const {
    bindings,
    byMember,
    assertDependenciesCurrent
  } = input;
  /**
   Authenticate an opaque member without requiring current source eligibility.

   @param member - original prepared member handle

   @returns original retained member record

   @throws JudgmentConstructionError for foreign membership
   */
  function knownMember(member: unknown): ProgramMemberRecord {
    /**
     Read capability preserves native primitive lookup without adding a new rejection boundary.
     */
    const memberBindings: OriginalMembershipRead<ProgramMemberRecord> = bindings;
    /**
     Original record remains shared with child program ownership.
     */
    const record = memberBindings.get(member);
    if (!record) throw new JudgmentConstructionError('Execution member handle is not owned by this judgment');
    return record;
  }
  /**
   Authenticate an original reserved execution independently of whether it has returned.

   @param token - original execution occurrence

   @returns original member record with its published execution

   @throws JudgmentConstructionError for foreign execution
   */
  function knownExecution(token: object): ProgramExecutionRecord {
    /**
     Only successful reservation publishes into this private map.
     */
    const record = executions.get(token);
    if ((!record) || (!hasExecution(record))
      || (record.execution
        .token
        !== token)) {
      throw new JudgmentConstructionError('Execution occurrence is not owned by this judgment');
    }
    return record;
  }
  /**
   Require the immediate parent at entry without extending its lifetime to an already active child.

   @param record - original member whose entry is being checked

   @throws JudgmentConstructionError when immediate parent has returned
   */
  function parentCurrent(record: ProgramMemberRecord): void {
    if ((record.parent !== undefined) && (knownExecution(record.parent)
      .execution
      .state
      !== 'active')) {
      throw new JudgmentConstructionError('Immediate parent execution has returned before child entry');
    }
    record.effectiveSignal
      ?.throwIfAborted();
  }
  /**
   Resolve a declared identifier only after current dependency authentication.

   @param memberId - declared native member identifier

   @returns original opaque prepared member handle

   @throws JudgmentConstructionError for absent prepared membership
   */
  function memberFor(memberId: string): object {
    assertDependenciesCurrent();
    /**
     Identifier lookup selects an existing owned occurrence without creating authority.
     */
    const member = byMember.get(memberId);
    if (!member) throw new JudgmentConstructionError('Execution member was not in the prepared native group');
    return member;
  }
  return {
    knownMember,
    knownExecution,
    parentCurrent,
    memberFor
  };
}
//endregion
