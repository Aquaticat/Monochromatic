/** Original native events publish recorder state before host events and ticket settlement. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { ProgramNativeCall } from './program-operation-types.ts';
import type {
  ProgramEventOutcome,
  ProgramRunnerEvents,
  ProgramRunnerEventsInput
} from './program-runner-events-types.ts';

/** Event diagnostics avoid native argument and result contents. */
const l = tagged({ tag: 'auto-mode-program-runner-events' });

//region Original recorder publication and asynchronous host event delivery preserve callback order.
/** Create native callbacks over the original bound scope and preallocated record map.
 @param runner - original host whose event callback retains its receiver
 @param bound - original recorder and member ticket association
 @param parentId - original prepared parent event identifier
 @param records - original map allocated before queue selection
 @returns native start, update, and finish callbacks
 @example createProgramRunnerEvents({ runner, bound, parentId, records });
 */
export function createProgramRunnerEvents({
  runner,
  bound,
  parentId,
  records
}: ProgramRunnerEventsInput): ProgramRunnerEvents {
  /** Callback logger retains the original factory boundary. */
  const el = tagged({ tag: createProgramRunnerEvents.name, l });
  el.debug('creating original native event callbacks');
  /** Original recorder and transport identities remain shared across callbacks. */
  const { scope, ordinals, tickets } = bound;
  /** Object methods retain native positional callback signatures without requiring a receiver. */
  const callbacks = {
    /** Record original native entry before publishing its host event.
     @param call - original prepared native call
     */
    async onStart(this: void, call: ProgramNativeCall): Promise<void> {
      /** Entry diagnostics precede recorder publication. */
      const sl = tagged({ tag: callbacks.onStart.name, l: el });
      sl.debug('recording original native entry');
      records.set(call.id, scope.recorder.start(call));
      await runner.host.emit({
        type: 'tool_execution_start',
        toolCallId: call.id,
        toolName: call.name,
        args: call.arguments,
        parentToolCallId: parentId
      });
    },
    /** Forward the exact native partial result through its original host.
     @param partialResult - original partial native result
     @param call - original prepared native call
     */
    async onUpdate(this: void, partialResult: unknown, call: ProgramNativeCall): Promise<void> {
      /** Update diagnostics do not inspect partial results. */
      const ul = tagged({ tag: callbacks.onUpdate.name, l: el });
      ul.debug('publishing original native update');
      await runner.host.emit({
        type: 'tool_execution_update',
        toolCallId: call.id,
        toolName: call.name,
        args: call.arguments,
        partialResult,
        parentToolCallId: parentId
      });
    },
    /** Finish original recording and await host publication before resolving the member ticket.
     @param outcome - original complete native outcome
     */
    async onFinish(this: void, outcome: ProgramEventOutcome): Promise<void> {
      /** Completion diagnostics identify the boundary without traversing native content. */
      const fl = tagged({ tag: callbacks.onFinish.name, l: el });
      fl.debug('recording original native completion');
      /** Original call identity selects its recorder entry and eventual member ticket. */
      const call = outcome.toolCall;
      /** Original text extraction deliberately preserves join coercion and excludes non-text parts. */
      const text = (outcome.result.content ?? []).filter(function isTextPart(part) {
        return part.type === 'text';
      }).map(function readTextPart(part) {
        return part.text;
      }).join('\n');
      scope.recorder.finish(records.get(call.id), outcome.isError, text);
      if (Boolean(outcome.result.usage)) scope.recorder.addUsage(outcome.result.usage);
      await runner.host.emit({
        type: 'tool_execution_end',
        toolCallId: call.id,
        toolName: call.name,
        result: outcome.result,
        isError: outcome.isError,
        parentToolCallId: parentId
      });
      /** Bound member association is read only after host publication finishes. */
      const ordinal = nonNullishOrThrow(ordinals.get(call.id));
      /** Missing transport fails explicitly instead of invoking a missing resolver. */
      const ticket = nonNullishOrThrow(tickets[ordinal]);
      ticket.resolve(outcome);
      fl.debug('resolved original native member ticket');
    },
  };
  return callbacks;
}
//endregion
