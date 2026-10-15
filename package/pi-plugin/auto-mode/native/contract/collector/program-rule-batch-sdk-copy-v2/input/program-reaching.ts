/**
 Reached groups materialize original argument patterns only from owned producer values. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { materializePattern } from './result-pattern.mjs';
import { JudgmentConstructionError } from './judgment-error.ts';
import { requireJSONInput } from './judgment-json.ts';
import type {
  ReachedProgramSite,
  ReachedProgramView
} from './program-declaration-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type { ProgramGroup } from './program-state-types.ts';
import type { ProgramReaching } from './program-api.ts';

/**
 Original reached argument data remains bounded in UTF-8 bytes.
 */
const MAX_REACHED_ARGUMENT_BYTES = 1_048_576;

//region A reached view is published only after complete argument materialization and currentness.
/**
 Bind original source-group reachability to the same program ownership readers.

 @param ownership - original current program and group readers

 @returns original reached-group operations

 @example createProgramReaching(ownership);
 */
export function createProgramReaching(ownership: ProgramOwnership): ProgramReaching {
  /**
   Original custody readers retain their distinct retained and current-use boundaries.
   */
  const {
    currentProgram,
    currentGroup
  } = ownership;
  /**
   Materialize all original group arguments before publishing their immutable view.

   @param program - original opaque program handle

   @param ordinal - original source group position

   @returns original reached view when published
   */
  function reachProgramGroup({
    program,
    ordinal
  }: Readonly<{
    program: object;
    ordinal: number
  }>): ProgramGroup['view'] {
    /**
     Original parent record supplies the reserved execution and cancellation dependency.
     */
    const parent = currentProgram(program);
    /**
     Original program scope retains declaration, terminal failure, and producer receipt state.
     */
    const scope = nonNullishOrThrow(parent.program);
    /**
     Original reached-group identity remains independent of copied declaration metadata.
     */
    const group = scope.groups[ordinal];
    if ((!Number.isSafeInteger(ordinal)) || (!group)) throw new JudgmentConstructionError('Program group ordinal is outside original source');
    if (group.state === 'failed') throw new JudgmentConstructionError(
      'Reached group failed permanently',
      { cause: group.failure }
    );
    if (group.state !== 'unreached') return group.view;
    /**
     Only a retained producer value may populate successor argument patterns.
     */
    const result = ordinal === 0 ? undefined : scope.valueReceipt
      ?.value;
    if ((ordinal > 0) && (!scope.valueReceipt)) throw new JudgmentConstructionError('Successor group requires the owned producer script value');
    /**
     Complete materialized members remain frozen in original source order.
     */
    const members = Object.freeze(group.definition
      .members
      .map(function materializeGroupMember(site): ReachedProgramSite {
      /**
       Original source-owned pattern materializes data without evaluating replacement code.
       */
      const args = materializePattern({
        pattern: site.pattern,
        ...(result === undefined ? {} : { result })
      });
      requireJSONInput(args);
      return Object.freeze({
        ...site,
        args,
        argsJSON: nonNullishOrThrow(JSON.stringify(args))
      });
    }));
    if (Buffer.byteLength(
      JSON.stringify(members.map(function readMemberArguments(member) { 
        return member.args; 
      })),
    ) > MAX_REACHED_ARGUMENT_BYTES) throw new JudgmentConstructionError('Reached group argument data exceeds one MiB');
    currentProgram(program);
    /**
     Immutable view publishes the original declaration and owned identities together.
     */
    const view: ReachedProgramView = Object.freeze({
      handle: group.handle,
      ordinal,
      declaration: nonNullishOrThrow(scope.declaration),
      members
    });
    group.view = view;
    group.state = 'reached';
    return group.view;
  }
  /**
   Read a reached view only while its original group remains current.

   @param group - original opaque group handle

   @returns original group view when published
   */
  function reachedGroupFor(group: object): ProgramGroup['view'] {
    return currentGroup(group)
      .view;
  }
  return {
    reachProgramGroup,
    reachedGroupFor
  };
}
//endregion
