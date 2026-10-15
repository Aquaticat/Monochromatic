/**
 Original root membership publishes only after complete preparation and dependency validation. @module
 */
import type { JudgmentPreparationInput } from './judgment-preparation-types.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';

//region Original binding and member identities are created only at the final publication boundary.
/**
 Publish complete original root membership in native declaration order.

 @param members - original frozen members whose complete input and dependencies were validated

 @param bindings - shared original instruction and execution ownership map

 @param byMember - complete identifier index shared by native judgment owners

 @param signal - original judgment cancellation retained for each member

 @example publishJudgmentMembers({ members, bindings, byMember, signal });
 */
export function publishJudgmentMembers({
  members,
  bindings,
  byMember,
  signal,
}: Pick<JudgmentPreparationInput, 'bindings' | 'byMember' | 'signal'> & Readonly<{
  members: readonly ProgramPreparedMember[];
}>): void {
  for (const [ordinal, member] of members.entries()) {
    /**
     Member lookup uses an original opaque handle independent of the prepared data.
     */
    const bindingHandle = Object.freeze({});
    /**
     Canonical claim binding retains its own immutable occurrence identity.
     */
    const identity = Object.freeze({});
    /**
     Original declaration order supplies the question binding's complete projection.
     */
    const projection = Object.freeze({ memberOrdinal: ordinal });
    bindings.set(
      bindingHandle,
      {
      binding: Object.freeze({
        identity,
        projection
      }),
      prepared: member,
      effectiveSignal: signal,
    }
    );
    byMember.set(
      member.id,
      bindingHandle
    );
  }
}
//endregion
