/**
 Final reached members retain original native identities, argument bytes, and cancellation. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { isProgramArray } from './program-array.ts';
import { requireJSONInput } from './judgment-json.ts';
import type {
  PrepareReachedMembersInput,
  ProgramContext
} from './program-operation-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type { ProgramMemberRecord } from './program-state-types.ts';
import type { JudgmentPrograms } from './program-api.ts';

/**
 Original final group storage remains bounded in UTF-8 bytes.
 */
const MAX_REACHED_GROUP_BYTES = 1_048_576;

//region Child member publication follows complete original native identity and cancellation checks.
/**
 Bind final child preparation to the original parent and reached-group custody.

 @param input - original judgment capabilities

 @param ownership - original program and reached-group readers

 @returns original final child preparation operation

 @example createProgramMemberPreparation({ input, ownership });
 */
export function createProgramMemberPreparation({
  input,
  ownership
}: Pick<ProgramContext, 'input'> & Readonly<{ ownership: ProgramOwnership }>): JudgmentPrograms['prepareReachedMembers'] {
  /**
   Captured original judgment capabilities remain fixed throughout this helper’s lifetime.
   */
  const {
    signal,
    bindings,
    childGroups
  } = input;
  /**
   Original custody readers retain their distinct retained and current-use boundaries.
   */
  const {
    currentGroup,
    knownProgram
  } = ownership;
  /**
   Publish members only after complete original input and signal admission succeeds.

   @param group - original opaque reached-group handle

   @param members - complete frozen original prepared sequence

   @param nativeSignals - native cancellation signals in original declared order

   @returns frozen original prepared member handles
   */
  function prepareReachedMembers({
    group: handle,
    members,
    nativeSignals
  }: PrepareReachedMembersInput): readonly object[] {
    /**
     Original reached-group identity remains independent of copied declaration metadata.
     */
    const group = currentGroup(handle);
    /**
     Original parent record supplies the reserved execution and cancellation dependency.
     */
    const parent = knownProgram(group.program);
    /**
     Original program scope retains declaration, terminal failure, and producer receipt state.
     */
    const scope = nonNullishOrThrow(parent.program);
    if (group.state !== 'bound') throw new JudgmentConstructionError('Reached group cannot be prepared again');
    group.state = 'preparing';
    try {
      /**
       Reached source declaration determines the complete final child group shape.
       */
      const declared = nonNullishOrThrow(group.view)
        .members;
      if ((!isProgramArray(members)) || (!Object.isFrozen(members))
        || (members.length !== declared.length)
        || (!isProgramArray(nativeSignals))
        || (nativeSignals.length !== declared.length)) throw new JudgmentConstructionError('Final child group differs from complete reached declaration');
      /**
       Unpublished records remain private until the complete group passes admission.
       */
      const pending: ProgramMemberRecord[] = [];
      for (const [index, member] of members.entries()) {
        /**
         Original declared members determine native names and exact serialized arguments.
         */
        const expected = nonNullishOrThrow(declared[index]);
        /**
         Original slot retains native call identity before prepared-member publication.
         */
        const slot = nonNullishOrThrow(group.slots[index]);
        /**
         Each child retains the cancellation signal supplied by its original native invocation.
         */
        const nativeSignal = nativeSignals[index];
        if ((!member) || (!Object.isFrozen(member))
          || (member.id !== slot.call.id)
          || (member.name !== expected.name)
          || (!Object.isFrozen(member.input))) throw new JudgmentConstructionError('Final child identity differs from bound native call');
        requireJSONInput(member.input);
        if (JSON.stringify(member.input) !== expected.argsJSON) throw new JudgmentConstructionError('Final prepared child input is outside its original result binding');
        if (!(nativeSignal instanceof AbortSignal)) throw new JudgmentConstructionError('Child native cancellation is unavailable');
        /**
         Combined cancellation preserves original judgment, parent, and native child signals.
         */
        const effectiveSignal = AbortSignal.any([
          signal,
          parent.execution.origin.signal,
          nativeSignal
        ]);
        effectiveSignal.throwIfAborted();
        pending.push({
          prepared: member,
          parent: nonNullishOrThrow(scope.view).parent,
          effectiveSignal,
          group
        });
      }
      if (Buffer.byteLength(JSON.stringify(members)) > MAX_REACHED_GROUP_BYTES) throw new JudgmentConstructionError('Final reached group exceeds one MiB');
      currentGroup(handle);
      /**
       Complete original member handles publish only after the final dependency check.
       */
      const handles = Object.freeze(pending.map(function publishReachedMember(
        record,
        index
      ) {
        /**
         Opaque prepared-member identity belongs to this original judgment alone.
         */
        const member = Object.freeze({});
        bindings.set(
          member,
          record
        );
        nonNullishOrThrow(group.slots[index])
          .member = member;
        return member;
      }));
      group.members = handles;
      group.state = 'prepared';
      childGroups.push(group);
      return handles;
    } catch (error) {
      group.state = 'failed';
      group.failure = error;
      throw error;
    }
  }
  return prepareReachedMembers;
}
//endregion
