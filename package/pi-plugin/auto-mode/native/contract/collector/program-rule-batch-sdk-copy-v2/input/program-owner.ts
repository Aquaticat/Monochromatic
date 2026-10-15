/**
 Original judgment program ownership composes source, reached-group, native-call, and result boundaries. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  createProgramState,
  createProgramOwnership
} from './program-ownership.ts';
import { createProgramOpening } from './program-opening.ts';
import { createProgramReaching } from './program-reaching.ts';
import { createProgramCallBinding } from './program-call-binding.ts';
import { createProgramMemberPreparation } from './program-member-preparation.ts';
import { createProgramValueAccess } from './program-value-access.ts';
import { createProgramInspection } from './program-inspection.ts';
import type { JudgmentProgramsInput } from './program-state-types.ts';
import type { JudgmentPrograms } from './program-api.ts';

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
export function createJudgmentPrograms(input: JudgmentProgramsInput): JudgmentPrograms {
  /**
   Preserve the original constructor's single property-read pass and incumbent order.
   */
  const {
    readJudgment,
    response,
    stream,
    signal,
    knownMember,
    knownExecution,
    ready,
    dependencyCheck,
    assertDependenciesCurrent,
    parentCurrent,
    bindings,
    childGroups,
    operation
  } = input;
  /**
   Captured capabilities preserve constructor property reads without rereading caller getters.
   */
  const originalInput: JudgmentProgramsInput = {
    readJudgment,
    response,
    stream,
    signal,
    knownMember,
    knownExecution,
    ready,
    dependencyCheck,
    assertDependenciesCurrent,
    parentCurrent,
    bindings,
    childGroups,
    operation
  };
  /**
   Program construction diagnostics omit original source and native argument values.
   */
  const rl = tagged({
    tag: createJudgmentPrograms.name,
    l
  });
  rl.debug('binding original program ownership');
  /**
   Private maps belong to this original judgment and are never reconstructed from metadata.
   */
  const state = createProgramState();
  /**
   Shared helpers borrow the same captured capabilities and private ownership maps.
   */
  const context = {
    input: originalInput,
    state
  };
  /**
   Original handle readers keep retained inspection separate from current-use admission.
   */
  const ownership = createProgramOwnership(context);
  /**
   Composed operations share the original judgment’s fixed capabilities and custody maps.
   */
  const {
    bindPreparedProgram,
    preparedProgramFor,
    openProgram,
    programFor
  } = createProgramOpening({
    ...context,
    ownership
  });
  /**
   Composed operations share the original judgment’s fixed capabilities and custody maps.
   */
  const {
    reachProgramGroup,
    reachedGroupFor
  } = createProgramReaching(ownership);
  /**
   Complete native call binding retains the original fixed return consumer.
   */
  const bindProgramCalls = createProgramCallBinding({
    ...context,
    ownership
  });
  /**
   Final child publication retains original arguments, call identities, and cancellation.
   */
  const prepareReachedMembers = createProgramMemberPreparation({
    input: originalInput,
    ownership
  });
  /**
   Composed operations share the original judgment’s fixed capabilities and custody maps.
   */
  const {
    invokeProgramNative,
    scriptValueFor,
    markProgramGuard
  } = createProgramValueAccess({
    input: originalInput,
    ownership
  });
  /**
   Composed operations share the original judgment’s fixed capabilities and custody maps.
   */
  const {
    inspectReachedGroup,
    inspectProgram
  } = createProgramInspection({
    input: originalInput,
    ownership
  });
  return Object.freeze({
    bindPreparedProgram,
    preparedProgramFor,
    openProgram,
    programFor,
    reachProgramGroup,
    reachedGroupFor,
    bindProgramCalls,
    prepareReachedMembers,
    invokeProgramNative,
    scriptValueFor,
    markProgramGuard,
    inspectReachedGroup,
    inspectProgram
  });
}
//endregion
