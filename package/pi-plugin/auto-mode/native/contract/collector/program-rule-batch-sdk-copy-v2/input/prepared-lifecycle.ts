/**
 Original native member lifecycle preserves preparation ordering and synchronous disposal. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  PreparedLifecycleInput,
  PreparedLifecycleMember
} from './prepared-lifecycle-types.ts';

/**
 Lifecycle diagnostics omit native arguments, result payloads, and opaque failures.
 */
const l = tagged({ tag: 'auto-mode-prepared-lifecycle' });

//region Borrow original native callbacks while retaining member turn release and failure ownership.
/**
 Run an original scheduled member through its native lifecycle.

 @param call - original declared native member

 @param ordinalByID - original declared member lookup

 @param waitForPreparation - original preparation turn lookup

 @param releaseNextPreparation - original synchronous preparation release

 @param releaseNextExecution - original synchronous execution release

 @param onStart - original awaited start notification

 @param onFinish - original awaited finish notification

 @param onUpdate - original synchronous partial result forwarding

 @param runToolCall - original native SDK execution callback

 @param executableTools - original admitted native definitions

 @param assistantMessage - original native message identity

 @param context - original native context identity

 @param signal - original cancellation identity

 @param after - original native completion hook

 @param prepareNativeMember - original shared group preparation owner

 @param failures - original retained lifecycle failures

 @param block - original complete-group blocking callback

 @param PreparedBatchContractError - original missing-member diagnostic constructor

 @returns original native result after its finish notification and turn disposal

 @throws Error for original ordinal, callback, queue, or disposal failures

 @example runPreparedLifecycle({ call, ordinalByID, waitForPreparation, releaseNextPreparation, releaseNextExecution, onStart, onFinish, onUpdate, runToolCall, executableTools, assistantMessage, context, signal, after, prepareNativeMember: prepareMember, failures, block, PreparedBatchContractError });
 */
export async function runPreparedLifecycle({
  call,
  ordinalByID,
  waitForPreparation,
  releaseNextPreparation,
  releaseNextExecution,
  onStart,
  onFinish,
  onUpdate,
  runToolCall,
  executableTools,
  assistantMessage,
  context,
  signal,
  after,
  prepareNativeMember: prepareMember,
  failures,
  block,
  PreparedBatchContractError
}: PreparedLifecycleInput): Promise<unknown> {
  /**
   Entry tracing does not inspect borrowed native payloads.
   */
  const rl = tagged({
    tag: runPreparedLifecycle.name,
    l
  });
  rl.debug('entering original prepared member lifecycle');
  /**
   Original preparation publishes its progress before releasing the next member.
   */
  const memberState: PreparedLifecycleMember = {
    entered: false,
    preparationReleased: false
  };
  /**
   Undeclared members fail before acquiring disposal or retained-failure ownership.
   */
  const ordinal = ordinalByID.get(call.id);
  if (ordinal === undefined) throw new PreparedBatchContractError('Preparation has no declared member ordinal');
  /**
   Declared ordinal stays narrowed inside the retained release closure.
   */
  const declaredOrdinal: number = ordinal;
  /**
   Release preparation once, including when the original release callback throws.
   */
  function releasePreparation(): void {
    if (memberState.preparationReleased) return;
    memberState.preparationReleased = true;
    releaseNextPreparation(declaredOrdinal);
  }
  /**
   Synchronous disposal runs after native return or catch without retaining disposal failures.
   */
  using memberTurn = { [Symbol.dispose](): void {
    releasePreparation();
    releaseNextExecution(ordinal);
  } };
  try {
    await waitForPreparation(ordinal);
    await onStart?.(call);
    /**
     Native callbacks retain original synchronous forwarding and opaque return identities.
     */
    const result = await runToolCall(
      call,
      {
      tools: executableTools,
      assistantMessage,
      context,
      signal,
      afterToolCall: after,
      onUpdate: onUpdate === undefined ? undefined : function forwardPartialUpdate(partial): unknown { 
        return onUpdate(
          partial,
          call
        ); 
      },
      beforeToolCall: function prepareNativeMember(hook) { 
        return prepareMember({
          hook,
          call,
          memberState,
          releasePreparation
        }); 
      },
    }
    );
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
