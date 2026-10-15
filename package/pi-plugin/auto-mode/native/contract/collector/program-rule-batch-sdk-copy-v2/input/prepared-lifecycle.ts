/**
 Original native member lifecycle preserves preparation ordering and synchronous disposal. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { PreparedLifecycleInput, PreparedLifecycleMember } from './prepared-lifecycle-types.ts';

/**
 Lifecycle diagnostics omit native arguments, result payloads, and opaque failures.
 */
const l = tagged({ tag: 'auto-mode-prepared-lifecycle' });

//region Borrow original native callbacks while retaining member turn release and failure ownership.
/**
 Run an original scheduled member through its native lifecycle.

 @param input - original callbacks, shared failures, and queue capabilities

 @returns original native result after its finish notification and turn disposal

 @throws Error for original ordinal, callback, queue, or disposal failures

 @example runPreparedLifecycle({ call, ordinalByID, waitForPreparation, releaseNextPreparation, releaseNextExecution, onStart, onFinish, onUpdate, runToolCall, executableTools, assistantMessage, context, signal, after, prepareNativeMember, failures, block, PreparedBatchContractError });
 */
export async function runPreparedLifecycle({ call, ordinalByID, waitForPreparation, releaseNextPreparation, releaseNextExecution, onStart, onFinish, onUpdate, runToolCall, executableTools, assistantMessage, context, signal, after, prepareNativeMember, failures, block, PreparedBatchContractError }: PreparedLifecycleInput): Promise<unknown> {
  /**
   Entry tracing does not inspect borrowed native payloads.
   */
  const rl = tagged({ tag: runPreparedLifecycle.name, l });
  rl.debug('entering original prepared member lifecycle');
  /**
   Original preparation publishes its progress before releasing the next member.
   */
  const memberState: PreparedLifecycleMember = { entered: false, preparationReleased: false };
  /**
   Undeclared members fail before acquiring disposal or retained-failure ownership.
   */
  const ordinal = ordinalByID.get(call.id);
  if (ordinal === undefined) throw new PreparedBatchContractError('Preparation has no declared member ordinal');
  /**
   Release preparation once, including when the original release callback throws.
   */
  function releasePreparation(): void {
    if (memberState.preparationReleased) return;
    memberState.preparationReleased = true;
    releaseNextPreparation(ordinal);
  }
  using memberTurn = { [Symbol.dispose]() { releasePreparation(); releaseNextExecution(ordinal); } };
  try {
    await waitForPreparation(ordinal);
    await onStart?.(call);
    /**
     Native callbacks retain original synchronous forwarding and opaque return identities.
     */
    const result = await runToolCall(call, {
      tools: executableTools,
      assistantMessage,
      context,
      signal,
      afterToolCall: after,
      onUpdate: onUpdate === undefined ? undefined : function forwardPartialUpdate(partial) { return onUpdate(partial, call); },
      beforeToolCall: function prepareNativeMemberHook(hook) { return prepareNativeMember({ hook, call, memberState, releasePreparation }); },
    });
    if (!memberState.entered) block('A member failed native preparation before group admission');
    await onFinish?.(result);
    return result;
  } catch (error) {
    failures.push(error);
    block('Native member lifecycle failed');
    throw error;
  }
}
//endregion
