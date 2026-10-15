/**
 Original preparation seals each input before complete-group assessment and native release. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  PreparedDecisionProperties,
  PreparedMember,
  PreparedMemberInput
} from './prepared-member-types.ts';

/**
 Preparation diagnostics omit original arguments and decision reasons.
 */
const l = tagged({ tag: 'auto-mode-prepared-member' });

/**
 Retain original property access on any non-nullish preparation result, including boxed primitives.

 @param value - opaque original native preparation return

 @returns whether ordinary optional-property access can observe this value
 */
function hasPreparationProperties(value: unknown): value is PreparedDecisionProperties {
  return (value !== null) && (value !== undefined);
}
/**
 Preserve original object-only assessment admission without extra property existence checks.

 @param value - opaque original assessment return

 @returns whether original assessment property validation may proceed
 */
function isAssessmentObject(value: unknown): value is PreparedDecisionProperties {
  return (value !== null) && ((typeof value) === 'object');
}
/**
 Preserve JavaScript truthiness without narrowing or re-reading an original property.

 @param value - original optional property value

 @returns whether original truthiness treats this value as absent
 */
function isAbsent(value: unknown): boolean {
  /**
   Boolean conversion retains original falsy values without re-reading a property.
   */
  const present = Boolean(value);
  return !present;
}

//region Enter original native preparation and await the shared complete-group decision.
/**
 Prepare an original native member within its dispatcher's complete-group admission.

 @param hook - original native hook carrying prepared arguments

 @param call - original scheduled native call

 @param memberState - original native-entry marker

 @param batchState - original shared assessment and admission state

 @param ready - original complete-group readiness map

 @param scheduled - original declaration order

 @param snapshots - retained original assessment manifests

 @param failures - retained original lifecycle failures

 @param serial - original selected execution mode

 @param signal - original assessment cancellation identity

 @param gate - original shared admission completion

 @param active - original synchronous currentness check

 @param prepare - original native preparation operation

 @param block - original first-decision blocking operation

 @param sealInput - original bounded argument sealer

 @param releasePreparation - original next-member preparation release

 @param assess - original complete-group judgment

 @param PreparedBatchContractError - original dispatcher diagnostic constructor

 @returns original blocking decision or absent restriction after group admission

 @throws Error if entry publication or retained-failure handling itself fails

 @example preparePreparedMember({ hook, call, memberState, batchState, ready, scheduled, snapshots, failures, serial, signal, gate, active, prepare, block, sealInput, releasePreparation, assess, PreparedBatchContractError });
 */
export async function preparePreparedMember({
  hook,
  call,
  memberState,
  batchState,
  ready,
  scheduled,
  snapshots,
  failures,
  serial,
  signal,
  gate,
  active,
  prepare,
  block,
  sealInput,
  releasePreparation,
  assess,
  PreparedBatchContractError,
}: PreparedMemberInput): Promise<unknown> {
  memberState.entered = true;
  /**
   Original native entry is published before any fallible preparation work.
   */
  const ml = tagged({
    tag: preparePreparedMember.name,
    l
  });
  ml.debug('entering original prepared member');
  try {
    active('prepare-entry');
    /**
     Optional native preparation may block the entire original group.
     */
    const prepared = await prepare(hook);
    if (hasPreparationProperties(prepared) && (!isAbsent(prepared.block))) {
      /**
       Original fallback observes the native reason only once.
       */
      const {reason} = prepared;
      block(isAbsent(reason) ? 'A member preparation blocked this complete group' : reason);
      return await gate.promise;
    }
    active('input-prepared');
    if (ready.has(call.id)) throw new PreparedBatchContractError('Member reached preparation twice');
    /**
     Original native arguments are sealed before their independent manifest snapshot.
     */
    const sealed = sealInput(hook.args);
    /**
     The manifest records the exact original call and a separately sealed cloned input.
     */
    const member: PreparedMember = Object.freeze({
      groupExecutionMode: serial ? 'sequential' : 'parallel',
      id: call.id,
      name: call.name,
      input: sealInput(structuredClone(sealed)),
    });
    ready.set(
      call.id,
      member
    );
    releasePreparation();
    if ((ready.size === scheduled.length) && (batchState.decision === undefined)
      && (!batchState.assessmentStarted)) {
      batchState.assessmentStarted = true;
      /**
       The assessment sees declaration order, independent of readiness insertion order.
       */
      const manifest = Object.freeze(scheduled.map(function readPreparedManifest(value) {
        return ready.get(value.id);
      }));
      snapshots.push(manifest);
      /**
       Original assessment may settle after cancellation or another retained blocking decision.
       */
      const assessed = await assess({
        members: manifest,
        signal
      });
      active('assessment-returned');
      if ((!isAssessmentObject(assessed)) || ((typeof assessed.block) !== 'boolean')
        || ((!isAbsent(assessed.block)) && (((typeof assessed.reason) !== 'string') || isAbsent(assessed.reason)))) {
        throw new PreparedBatchContractError('Combined assessment returned an invalid decision');
      }
      if (batchState.decision === undefined) {
        batchState.decision = Object.freeze(!isAbsent(assessed.block) ? {
          block: true,
          reason: assessed.reason,
        } : { block: false });
        gate.resolve(batchState.decision);
      }
    }
    /**
     Every original member rechecks currentness after the shared decision settles.
     */
    const selected = await gate.promise;
    active('member-release');
    return !isAbsent(selected.block) ? selected : undefined;
  } catch (error) {
    failures.push(error);
    ml.debug('retained original preparation or assessment failure');
    block('Complete group preparation or assessment failed');
    return {
      block: true,
      reason: 'Complete group preparation or assessment failed'
    };
  }
}
//endregion
