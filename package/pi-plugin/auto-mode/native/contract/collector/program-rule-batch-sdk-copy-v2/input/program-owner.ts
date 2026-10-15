/**
 Original judgment program ownership composes source, reached-group, native-call, and result boundaries. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createProgramState, createProgramOwnership } from './program-ownership.ts';
import { createProgramOpening } from './program-opening.ts';
import { createProgramReaching } from './program-reaching.ts';
import { createProgramCallBinding } from './program-call-binding.ts';
import { createProgramMemberPreparation } from './program-member-preparation.ts';
import { createProgramValueAccess } from './program-value-access.ts';
import { createProgramInspection } from './program-inspection.ts';
import type { JudgmentProgramsInput } from './program-state-types.ts';

/**
 Owner diagnostics omit original source, native arguments, and returned values.
 */
const l = tagged({ tag: 'auto-mode-judgment-programs' });

//region One original owner retains every program, reached group, native slot, and producer receipt.
/**
 Compose original program operations without invoking lazy judgment capabilities at construction.

 @param input - original synchronous judgment and native parent capabilities

 @returns original frozen program operation surface

 @example createJudgmentPrograms(input);
 */
export function createJudgmentPrograms(input: JudgmentProgramsInput) {
  /**
   Preserve the original constructor's single property-read pass and incumbent order.
   */
  const { readJudgment, response, stream, signal, knownMember, knownExecution, ready, dependencyCheck, assertDependenciesCurrent, parentCurrent, bindings, childGroups, operation } = input;
  const originalInput: JudgmentProgramsInput = { readJudgment, response, stream, signal, knownMember, knownExecution, ready, dependencyCheck, assertDependenciesCurrent, parentCurrent, bindings, childGroups, operation };
  const rl = tagged({ tag: createJudgmentPrograms.name, l });
  rl.debug('binding original program ownership');
  const state = createProgramState();
  const context = { input: originalInput, state };
  const ownership = createProgramOwnership(context);
  const { bindPreparedProgram, preparedProgramFor, openProgram, programFor } = createProgramOpening({ ...context, ownership });
  const { reachProgramGroup, reachedGroupFor } = createProgramReaching(ownership);
  const bindProgramCalls = createProgramCallBinding({ ...context, ownership });
  const prepareReachedMembers = createProgramMemberPreparation({ input: originalInput, ownership });
  const { invokeProgramNative, scriptValueFor, markProgramGuard } = createProgramValueAccess({ input: originalInput, ownership });
  const { inspectReachedGroup, inspectProgram } = createProgramInspection({ input: originalInput, ownership });
  return Object.freeze({ bindPreparedProgram, preparedProgramFor, openProgram, programFor, reachProgramGroup, reachedGroupFor, bindProgramCalls, prepareReachedMembers, invokeProgramNative, scriptValueFor, markProgramGuard, inspectReachedGroup, inspectProgram });
}
//endregion
