/**
 Original prepared execution wrappers retain queue and context-guard failure ordering. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  PreparedExecutableInput,
  PreparedExecutableTool,
  PreparedExecutionArguments,
} from './prepared-executable-types.ts';

/**
 Wrapper diagnostics omit original tool arguments, results, and failure values.
 */
const l = tagged({ tag: 'auto-mode-prepared-executable' });

//region Original native wrappers borrow queue turns and retain context guard failure ownership.
/**
 Wrap original native tools with complete-group execution admission.

 @param tools - original native definitions whose enumerable metadata is copied once

 @param ordinalByID - original declared-member lookup shared by the dispatcher

 @param serial - original complete-group queue policy

 @param waitForTurn - original synchronous execution-turn lookup whose result is awaited

 @param active - original cancellation and currentness check

 @param failures - original retained lifecycle failures

 @param batchState - original context-guard failure owner

 @param executionJudgment - original enclosing judgment passed unchanged to native execution

 @param executeWithOwnedContext - original native execution and context establishment callback

 @param NativeExecutionGuardError - original guard constructor used for failure classification

 @param PreparedBatchContractError - original dispatcher contract error constructor

 @returns original tool snapshots with admission-aware execution callbacks

 @example wrapPreparedTools({ tools, ordinalByID, serial, waitForTurn, active, failures, batchState, executionJudgment, executeWithOwnedContext, NativeExecutionGuardError, PreparedBatchContractError });
 */
export function wrapPreparedTools({
  tools,
  ordinalByID,
  serial,
  waitForTurn,
  active,
  failures,
  batchState,
  executionJudgment,
  executeWithOwnedContext,
  NativeExecutionGuardError,
  PreparedBatchContractError,
}: PreparedExecutableInput): PreparedExecutableTool[] {
  /**
   Wrapper construction keeps original context ownership private to the dispatcher.
   */
  const wl = tagged({
    tag: wrapPreparedTools.name,
    l
  });
  wl.debug('wrapping original prepared native definitions');
  return tools.map(function wrapOwnedTool(original) {
    /**
     Each copied definition keeps its own original native execution closure.
     */
    const tl = tagged({
      tag: wrapOwnedTool.name,
      l: wl
    });
    tl.debug('binding original prepared execution callback');
    /**
     Original enumerable tool metadata is copied before installing the native callback.
     */
    const wrapped = {
      ...original,
    /**
     Execute an admitted native member using its original context owner.

     @param toolCallId - declared original member identifier

     @param params - prepared original native argument object

     @param nativeSignal - original native cancellation signal

     @param nativeOnUpdate - original native update callback

     @returns original native execution result

     @throws Error for original ordinal, currentness, turn, or native execution failures
     */
    async execute(
      toolCallId: string,
      params: unknown,
      nativeSignal: unknown,
      nativeOnUpdate: unknown
    ): Promise<unknown> {
      /**
       Execution tracing preserves the wrapper boundary without inspecting native values.
       */
      const el = tagged({
        tag: executionName,
        l: tl
      });
      el.debug('entering original prepared execution callback');
      /**
       Native positional arguments are forwarded as one original unfrozen tuple.
       */
      const args: PreparedExecutionArguments = [
        toolCallId,
        params,
        nativeSignal,
        nativeOnUpdate
      ];
      /**
       Queue and native admission share the original declared ordinal.
       */
      const ordinal = ordinalByID.get(args[0]);
      if (ordinal === undefined) throw new PreparedBatchContractError('Execution has no declared member ordinal');
      if (serial) await waitForTurn(ordinal);
      try {
        active('member-execute');
      } catch (error) {
        failures.push(error);
        throw error;
      }
      if (batchState.executionGuardFailed) {
        /**
         An earlier context guard failure prevents every subsequent native execution.
         */
        const error = new PreparedBatchContractError('An execution context guard failed; remaining group members cannot start');
        failures.push(error);
        throw error;
      }
      try {
        return await executeWithOwnedContext({
          judgment: executionJudgment,
          tool: original,
          args
        });
      } catch (error) {
        if (error instanceof NativeExecutionGuardError) {
          batchState.executionGuardFailed = true;
          failures.push(error);
        }
        throw error;
      }
    },
    };
    /**
     Capture the callback name before callers can replace the returned tool's execution property.
     */
    const executionName = wrapped.execute
      .name;
    return wrapped;
  });
}
//endregion
