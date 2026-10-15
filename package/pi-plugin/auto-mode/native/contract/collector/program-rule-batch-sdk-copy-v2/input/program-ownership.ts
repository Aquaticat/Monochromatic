/**
 Private custody maps distinguish original program, group, and slot handles from copied data. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { ProgramContext } from './program-operation-types.ts';
import type { ProgramExecutionRecord, ProgramGroup, ProgramOwnerState, ProgramSlot } from './program-state-types.ts';

//region Original handle lookup keeps terminal inspection separate from current-use checks.
/**
 Allocate private ownership maps before any original program is reserved.

 @returns empty original program custody

 @example createProgramState();
 */
export function createProgramState(): ProgramOwnerState {
  return { programs: new WeakMap(), groups: new WeakMap(), slots: new WeakMap() };
}

/**
 Bind original ownership readers to the judgment's independent dependency guard.

 @param input - original judgment capabilities

 @param state - private original handle maps

 @returns original ownership and currentness readers

 @example createProgramOwnership({ input, state });
 */
export function createProgramOwnership({ input, state }: ProgramContext): ProgramOwnership {
  /**
   Captured dependency guard does not consult mutable caller properties again.
   */
  const { assertDependenciesCurrent } = input;
  /**
   Private maps are populated only at their original publication boundaries.
   */
  const { programs, groups, slots } = state;
  /**
   Authenticate a program before reading its retained scope.

   @param program - original opaque program handle

   @returns original parent execution record

   @throws JudgmentConstructionError for a foreign program handle
   */
  function knownProgram(program: object): ProgramExecutionRecord {
    const record = programs.get(program);
    if ((!record) || (nonNullishOrThrow(record.program).handle !== program)) throw new JudgmentConstructionError('Program handle is not owned by this judgment');
    return record;
  }
  /**
   Live program use requires the original scope, active parent, and current dependencies.

   @param program - original opaque program handle

   @returns current original parent execution record
   */
  function currentProgram(program: object): ProgramExecutionRecord {
    const record = knownProgram(program);
    const scope = nonNullishOrThrow(record.program);
    if (scope.guardFailure) throw scope.guardFailure;
    if (scope.status === 'failed') throw new JudgmentConstructionError('Program declaration failed permanently', { cause: scope.failure });
    if (record.execution?.state !== 'active') throw new JudgmentConstructionError('Program parent execution has returned');
    assertDependenciesCurrent();
    record.execution.origin.signal.throwIfAborted();
    return record;
  }
  /**
   Retained group inspection authenticates identity without requiring live eligibility.

   @param handle - original opaque reached-group handle

   @returns original group record
   */
  function knownGroup(handle: object): ProgramGroup {
    const group = groups.get(handle);
    if (!group) throw new JudgmentConstructionError('Reached group handle is not owned by this judgment');
    return group;
  }
  /**
   Current groups retain their original program and permanent failure state.

   @param handle - original opaque reached-group handle

   @returns current original group
   */
  function currentGroup(handle: object): ProgramGroup {
    const group = knownGroup(handle);
    currentProgram(group.program);
    if (group.state === 'failed') throw new JudgmentConstructionError('Reached group failed permanently', { cause: group.failure });
    return group;
  }
  /**
   Native slots remain members of exactly one original reached group.

   @param group - original group record

   @param slot - original opaque native slot handle

   @returns original group-owned slot
   */
  function knownSlot({ group, slot }: Readonly<{ group: ProgramGroup; slot: object }>): ProgramSlot {
    const record = slots.get(slot);
    if ((!record) || (record.group !== group)) throw new JudgmentConstructionError('Native slot is not owned by this reached group');
    return record;
  }
  return { knownProgram, currentProgram, knownGroup, currentGroup, knownSlot };
}
//endregion

/**
 Shared readers preserve original ownership and current-use ordering.
 */
export type ProgramOwnership = Readonly<{
  knownProgram: (program: object) => ProgramExecutionRecord;
  currentProgram: (program: object) => ProgramExecutionRecord;
  knownGroup: (handle: object) => ProgramGroup;
  currentGroup: (handle: object) => ProgramGroup;
  knownSlot: (input: Readonly<{ group: ProgramGroup; slot: object }>) => ProgramSlot;
}>;
