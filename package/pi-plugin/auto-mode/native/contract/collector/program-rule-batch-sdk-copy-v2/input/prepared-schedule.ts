/** Original prepared batch admission and scheduling preserve observation order. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { ProgramNativeCall } from './program-operation-types.ts';
import type { PreparedSchedule, PreparedScheduleInput } from './prepared-schedule-types.ts';

/** Scheduling diagnostics contain no original arguments or tool names. */
const l = tagged({ tag: 'auto-mode-prepared-schedule' });
/** Original declared member limit applies before any call is cloned. */
const MAX_MEMBERS = 64;
/** Original judgment support is checked in this short-circuit order. */
const EXECUTION_METHODS = ['memberFor', 'beginExecution', 'executionFor', 'finishExecution'] as const;

//region Validate and clone complete native groups before inspecting context capability or queue policy.
/** Prepare original call snapshots and select the original sequential execution branch.
 @param calls - declared native calls before preparation
 @param tools - original tool definitions in lookup order
 @param executionJudgment - original judgment whose support is inspected without invocation
 @param executionMode - caller scheduling mode with the original parallel default
 @param PreparedBatchContractError - original dispatcher error constructor
 @returns frozen per-call snapshots and complete-group queue selection
 @throws Error for original invalid calls, mode, or missing native capabilities
 @example schedulePreparedCalls({ calls, tools, executionJudgment, PreparedBatchContractError });
 */
export function schedulePreparedCalls({
  calls,
  tools,
  executionJudgment,
  executionMode = 'parallel',
  PreparedBatchContractError,
}: PreparedScheduleInput): PreparedSchedule {
  /** Function diagnostics retain the scheduling boundary without exposing prepared input. */
  const sl = tagged({ tag: schedulePreparedCalls.name, l });
  sl.debug('validating original prepared group schedule');
  if ((!Array.isArray(calls)) || (calls.length === 0) || (calls.length > MAX_MEMBERS)
    || calls.some(function isInvalidCall(call: ProgramNativeCall) {
      return (call.type !== 'toolCall') || ((typeof call.id) !== 'string')
        || (Boolean(call.id) === false) || ((typeof call.name) !== 'string')
        || (Boolean(call.name) === false);
    })
    || (new Set(calls.map(function readCallId(call: ProgramNativeCall) {
      return call.id;
    })).size !== calls.length)) throw new PreparedBatchContractError('Prepared batch requires one to64 unique named members');
  /** Clone calls separately so shared original argument identities do not cross member snapshots. */
  const scheduled = Object.freeze(calls.map(function cloneScheduledCall(call: ProgramNativeCall) {
    return Object.freeze(structuredClone(call));
  }));
  if ((executionMode !== 'parallel') && (executionMode !== 'sequential')) throw new PreparedBatchContractError('Unknown batch execution mode');
  if ((Boolean(executionJudgment) === false) || EXECUTION_METHODS.some(function isMissingExecutionSupport(name) {
    return (typeof executionJudgment?.[name]) !== 'function';
  })) throw new PreparedBatchContractError('Enclosing judgment lacks required native execution occurrence support');
  for (const call of scheduled) {
    /** Only the original first matching definition determines context capability. */
    const tool = tools.find(function matchesTool(value) {
      return value.name === call.name;
    });
    if ((Boolean(tool) === true) && ((typeof tool?.createExecutionContext) !== 'function')) throw new PreparedBatchContractError(`Tool ${JSON.stringify(call.name)} lacks required native context support; the complete group was not started`);
  }
  /** An explicit sequential mode bypasses per-tool execution-mode reads after capability validation. */
  const serial = (executionMode === 'sequential') || scheduled.some(function requiresSequentialExecution(call) {
    return tools.find(function matchesTool(tool) {
      return tool.name === call.name;
    })?.executionMode === 'sequential';
  });
  sl.debug('completed original prepared group scheduling');
  return { scheduled, serial };
}
//endregion
