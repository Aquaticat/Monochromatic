/**
 Original judgment views preserve current member access and retained terminal inspection. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { ProgramMemberRecord } from './program-state-types.ts';
import type {
  JudgmentInspectionInput,
  JudgmentInspection,
  JudgmentPreparedMemberView,
  JudgmentMemberExecutionView,
  JudgmentInspectionView,
} from './judgment-inspection-types.ts';

/**
 Inspection diagnostics omit original source contents and prepared arguments.
 */
const l = tagged({ tag: 'auto-mode-judgment-inspection' });

//region Live member reads retain their original checks while diagnostic views remain inert.
/**
 Bind original preparation, closure, and member records to their current and retained consumer views.

 @param input - shared original owners and separate currentness capabilities

 @returns original prepared-member, file, and retained judgment readers

 @example createJudgmentInspection(input);
 */
export function createJudgmentInspection(input: JudgmentInspectionInput): JudgmentInspection {
  /**
   Entry diagnostics do not invoke currentness, accounting, or retained program readers.
   */
  const rl = tagged({
    tag: createJudgmentInspection.name,
    l
  });
  rl.debug('binding original judgment inspection');
  /**
   The same original state objects remain live after preparation, assessment, and execution finish.
   */
  const {
    preparation,
    lifecycle,
    budget,
    byMember,
    bindings,
    childGroups,
    knownMember,
    assertDependenciesCurrent,
    parentCurrent,
    ready,
    originalFile,
    inspectProgram,
    inspectReachedGroup,
  } = input;
  /**
   Require the shared record guaranteed by original member publication.

   @param member - original handle already present in the declaration index

   @returns original shared instruction and execution record
   */
  function publishedRecord(member: object): ProgramMemberRecord {
    return nonNullishOrThrow(bindings.get(member));
  }
  /**
   Read original prepared data only after ownership, dependencies, and immediate-parent currentness.

   @param member - original native membership handle

   @returns frozen view retaining original member, signal, and source inspection identities
   */
  function preparedMemberFor(member: unknown): JudgmentPreparedMemberView {
    /**
     Ownership rejection precedes any dependency observation.
     */
    const record = knownMember(member);
    assertDependenciesCurrent();
    parentCurrent(record);
    return Object.freeze({
      prepared: record.prepared,
      signal: record.effectiveSignal,
      programInspection: record.preparedProgram
        ?.view,
    });
  }
  /**
   Read original file evidence after readiness, member ownership, and parent authentication.

   @param member - original native member whose prepared input selects the path

   @returns original dependency facade result without changing its identity
   */
  function originalFileFor(member: unknown): unknown {
    ready();
    /**
     The file path comes from the original prepared record, never from a separate caller argument.
     */
    const record = knownMember(member);
    parentCurrent(record);
    return originalFile({
      handle: preparation.handle,
      absolutePath: record.prepared
        .input
        .path
    });
  }
  /**
   Snapshot original root execution phases without consulting live eligibility.

   @returns frozen declaration-ordered execution records including unentered roots
   */
  function memberExecutionStates(): readonly JudgmentMemberExecutionView[] {
    return Object.freeze([...byMember.entries()].map(function readExecutionState([id, handle]) {
      return Object.freeze({
        id,
        state: publishedRecord(handle)
          .execution
          ?.state
          ?? 'unentered'
      });
    }));
  }
  /**
   Retain original preparation, closure, and program diagnostics without granting live access.

   @returns frozen original diagnostic view with independently frozen collection arrays
   */
  function inspect(): JudgmentInspectionView {
    return Object.freeze({
      prepared: preparation.prepared,
      preparationFailed: preparation.preparationFailed,
      preparationFailure: preparation.preparationFailure,
      finished: lifecycle.finished,
      closeFailed: lifecycle.closeFailed,
      accounting: budget.diagnostics(),
      finalRecord: lifecycle.finalRecord,
      memberExecutions: memberExecutionStates(),
      preparedPrograms: Object.freeze([...byMember.values()].flatMap(function readPreparedProgramView(member) {
        /**
         Optional original source inspection remains absent until explicitly bound.
         */
        const inspection = publishedRecord(member)
          .preparedProgram;
        return inspection ? [inspection.view] : [];
      })),
      rootPrograms: Object.freeze([...byMember.values()].flatMap(function readRootProgramView(member) {
        /**
         Root inspection retains the original program occurrence and diagnostics.
         */
        const record = publishedRecord(member);
        return record.program ? [inspectProgram(record.program
          .handle)] : [];
      })),
      childGroups: Object.freeze(childGroups.map(function inspectChildGroup(group) {
        return inspectReachedGroup(group.handle);
      })),
    });
  }
  return {
    preparedMemberFor,
    originalFileFor,
    inspect
  };
}
//endregion
