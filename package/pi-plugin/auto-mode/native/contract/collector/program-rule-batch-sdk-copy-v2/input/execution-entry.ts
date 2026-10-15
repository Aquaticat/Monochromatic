/**
 Original execution reservation and entry retain closed evidence and immediate-parent boundaries. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import type {
  JudgmentExecutionContext,
  JudgmentExecutionEntry,
  JudgmentExecutionInspection,
  JudgmentExecutionOwnership,
  JudgmentExecutionOrigin
} from './execution-types.ts';

//region Reservation is once-only and does not grant native execution permission.
/**
 Bind original execution methods to the judgment's private custody and live dependency checks.

 @param input - original enclosing execution capabilities

 @param executions - private original reservation map

 @param ownership - authenticated member and execution readers

 @returns original reservation and native entry operations

 @example createExecutionEntry({ input, executions, ownership });
 */
export function createExecutionEntry({
  input,
  executions,
  ownership
}: JudgmentExecutionContext & Readonly<{
  ownership: JudgmentExecutionOwnership;
}>): JudgmentExecutionEntry {
  /**
   Captured identity and phase readers are invoked only at original operation boundaries.
   */
  const {
    readClosure,
    readJudgment,
    response,
    stream,
    assertDependenciesCurrent
  } = input;
  /**
   Original readers retain shared member records and immediate-parent checks.
   */
  const {
    knownMember,
    knownExecution,
    parentCurrent
  } = ownership;
  /**
   Authenticate this original occurrence immediately before native entry.

   @param token - original reserved execution occurrence

   @throws JudgmentConstructionError after execution has returned
   */
  function assertExecutionEntry(token: object): void {
    /**
     Original execution state is checked before any external dependency reader.
     */
    const record = knownExecution(token);
    if (record.execution
      .state
      !== 'active') throw new JudgmentConstructionError('Execution occurrence has returned before native entry');
    assertDependenciesCurrent();
    parentCurrent(record);
  }
  /**
   Read original native origin only after authenticating this exact entry.

   @param token - original reserved execution occurrence

   @returns original frozen entry identities
   */
  function executionEntryFor(token: object): JudgmentExecutionOrigin {
    assertExecutionEntry(token);
    return knownExecution(token)
      .execution
      .origin;
  }
  /**
   Reserve one original occurrence only after successful evidence closure.

   @param member - original prepared member handle

   @returns opaque original execution occurrence

   @throws JudgmentConstructionError before successful closure or after prior reservation
   */
  function beginExecution(member: object): object {
    /**
     Original member authentication precedes all phase checks.
     */
    const record = knownMember(member);
    /**
     Snapshot reads the private closure flags without observing external dependencies.
     */
    const {
      finished,
      closeFailed
    } = readClosure();
    if ((!finished) || closeFailed) throw new JudgmentConstructionError('Execution occurrence requires successfully closed evidence');
    if (record.execution) throw new JudgmentConstructionError('Prepared member already reserved its execution occurrence');
    assertDependenciesCurrent();
    parentCurrent(record);
    /**
     Opaque identity is published only after every original entry dependency succeeds.
     */
    const token = Object.freeze({});
    /**
     Retained origin preserves enclosing identities while explicitly withholding permission.
     */
    const origin = Object.freeze({
      judgment: readJudgment(),
      response,
      stream,
      signal: record.effectiveSignal,
      member,
      prepared: record.prepared,
      permission: 'not-established' as const
    });
    record.execution = {
      token,
      state: 'active',
      origin
    };
    executions.set(
      token,
      record
    );
    return token;
  }
  /**
   Read an active occurrence without making ancestor lifetime an active-child dependency.

   @param token - original reserved execution occurrence

   @returns original frozen entry identities

   @throws JudgmentConstructionError when original occurrence has returned
   */
  function executionFor(token: object): JudgmentExecutionOrigin {
    /**
     Currentness checks follow original occurrence authentication and terminal state.
     */
    const record = knownExecution(token);
    if (record.execution
      .state
      !== 'active') throw new JudgmentConstructionError('Parent execution occurrence has returned');
    assertDependenciesCurrent();
    record.execution
      .origin
      .signal
      .throwIfAborted();
    return record.execution
      .origin;
  }
  /**
   Mark terminal state without reading source eligibility or cancellation.

   @param token - original reserved execution occurrence
   */
  function finishExecution(token: object): void {
    /**
     Terminal mutation retains the same shared occurrence record.
     */
    const record = knownExecution(token);
    record.execution
      .state = 'returned';
  }
  /**
   Inspect terminal state independently of current eligibility.

   @param token - original reserved execution occurrence

   @returns frozen retained state without execution authority
   */
  function inspectExecution(token: object): JudgmentExecutionInspection {
    /**
     Retained identity remains authenticated after cancellation or source retirement.
     */
    const record = knownExecution(token);
    return Object.freeze({
      retainedOnly: true,
      state: record.execution.state
    });
  }
  return {
    assertExecutionEntry,
    executionEntryFor,
    beginExecution,
    executionFor,
    finishExecution,
    inspectExecution
  };
}
//endregion
