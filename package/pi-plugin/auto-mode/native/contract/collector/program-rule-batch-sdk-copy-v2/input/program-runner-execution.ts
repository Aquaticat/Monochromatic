/**
 Original reached-group execution keeps queue release around complete native dispatch. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { acquireProgramQueue } from './program-scope.ts';
import { createProgramRunnerEvents } from './program-runner-events.ts';
import { createProgramExecutionCallbacks } from './program-runner-execution-callbacks.ts';
import type {
  ProgramAssessment,
  ProgramRunnerExecutionInput
} from './program-runner-execution-types.ts';

/**
 Queue and dispatch diagnostics avoid native arguments and event contents.
 */
const l = tagged({ tag: 'auto-mode-program-runner-execution' });

//region Original queue acquisition encloses currentness, cancellation, and complete native dispatch.
/** Execute the original complete reached group under its existing native queue owner.
 @param runner - original shared queue and host
 
 @param origin - original parent occurrence, response, and judgment
 
 @param group - original complete reached member group
 
 @param bound - original recorder and admitted native transport
 
 @param assertParentCurrent - original parent currentness check after queue acquisition
 
 @param dispatchPreparedBatch - original complete native dispatcher
 
 @example await executeReachedProgramGroup({ runner, origin, group, bound, assertParentCurrent, dispatchPreparedBatch });
 */
export async function executeReachedProgramGroup({
  runner,
  origin,
  group,
  bound,
  assertParentCurrent,
  dispatchPreparedBatch
}: ProgramRunnerExecutionInput): Promise<void> {
  /**
   Execution logging retains the original queue-owning boundary.
   */
  const el = tagged({
    tag: executeReachedProgramGroup.name,
    l
  });
  el.debug('selecting original reached-group queue ownership');
  /**
   Original binding provides the shared recorder, complete calls, and definition snapshot.
   */
  const {
    scope,
    calls,
    tools
  } = bound;
  /**
   Parent label remains the exact original prepared identifier.
   */
  const parentId = origin.prepared
    .id;
  /**
   Original execution judgment remains unchanged in dispatcher input.
   */
  const { judgment } = origin;
  /**
   Record allocation precedes original native sequential-mode evaluation.
   */
  const records = new Map<string, unknown>();
  /**
   A parent already holding the native queue must never acquire its own successor.
   */
  const exclusive = (!scope.holdsQueue) && (runner.host
    .isSequential()
    || calls.some(function requiresSequentialExecution(call) {
      return tools.find(function matchesCall(tool) {
        return tool.name === call.name;
      })
        ?.executionMode
        === 'sequential';
    }));
  /**
   Assessment publication belongs to this complete reached group only.
   */
  const assessment: ProgramAssessment = {};
  /**
   Acquired queue ownership lasts through currentness checks and complete native dispatch.
   */
  using queueTurn = exclusive ? await acquireProgramQueue(runner) : undefined;
  el.debug('checking original parent after queue selection');
  assertParentCurrent();
  origin.signal
    .throwIfAborted();
  await dispatchPreparedBatch({
    calls,
    tools,
    assistantMessage: origin.response,
    context: runner.host
      .getContext(),
    signal: origin.signal,
    executionJudgment: judgment,
    executionMode: exclusive ? 'sequential' : 'parallel',
    ...createProgramExecutionCallbacks({
      runner,
      origin,
      group,
      bound,
      assertParentCurrent,
      parentId,
      assessment
    }),
    ...createProgramRunnerEvents({
      runner,
      bound,
      parentId,
      records
    })
  });
  el.debug('completed original reached native group');
}
//endregion
