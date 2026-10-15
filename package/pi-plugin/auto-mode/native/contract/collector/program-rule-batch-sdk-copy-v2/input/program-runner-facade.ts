/**
 Declared program facade retains native group work through aggregate drainage. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { ProgramFacadeInput } from './program-runner-facade-types.ts';
import type { ProgramRunnerBinding } from './program-runner-binding-types.ts';
import type { ProgramEventRecorder } from './program-runner-events-types.ts';
import type { ProgramRuntime } from './program-runtime-types.ts';

/**
 Facade diagnostics retain lifecycle boundaries without logging source or arguments.
 */
const l = tagged({ tag: 'auto-mode-program-runner-facade' });

//region Original declaration opens once and retains every reached native group and failure.
/** Open the original declared program and retain its outstanding native execution work.
 @param tools - original frozen definition snapshot
 *
 @param origin - original prepared program and judgment
 *
 @param carrier - original parent occurrence token
 *
 @param code - exact original prepared program source
 *
 @param assertParentCurrent - original parent freshness callback
 *
 @param bindGroup - original private runner binding wrapper
 *
 @param executeGroup - original private asynchronous execution wrapper
 *
 @param createReachedProgramRun - original reached runtime constructor
 *
 @param NativeExecutionGuardError - original aggregate execution guard constructor
 *
 @returns frozen original runtime facade with aggregate native drainage
 *
 @throws Error when tool snapshot or declared source is unavailable
 *
 @example createDeclaredProgramFacade({ tools, origin, carrier, code, assertParentCurrent, bindGroup, executeGroup, createReachedProgramRun, NativeExecutionGuardError });
 */
export function createDeclaredProgramFacade({
  tools,
  origin,
  carrier,
  code,
  assertParentCurrent,
  bindGroup,
  executeGroup,
  createReachedProgramRun,
  NativeExecutionGuardError
}: ProgramFacadeInput): ProgramRuntime<string> {
  /**
   Original facade scope labels entry, settlement, and aggregate drainage.
   */
  const fl = tagged({
    tag: createDeclaredProgramFacade.name,
    l
  });
  fl.debug('opening original declared program');
  if ((!Array.isArray(tools)) || (!Object.isFrozen(tools))) throw new Error('Original request tool snapshot is unavailable');
  assertParentCurrent();
  if (code
    !== origin.prepared
    .input
    .code) throw new Error('Declared program differs from original prepared input');
  /**
   Original judgment is captured before opening can call external code.
   */
  const { judgment } = origin;
  /**
   Tool names preserve original order and duplicate definitions.
   */
  const toolNames = tools.map(function readToolName(tool) { return tool.name; });
  /**
   Original parent token opens the judgment-owned program exactly once.
   */
  const program = judgment.openProgram({
    parentToken: carrier.token,
    toolNames
  });
  /**
   Native associations remain available for source result conversion.
   */
  const nativeGroups = new Map<object, ProgramRunnerBinding<ProgramEventRecorder>>();
  /**
   Settlement work is retained even after transport tickets resolve.
   */
  const works: Promise<void>[] = [];
  /**
   Original caught values retain order and nullish failure identity.
   */
  const failures: unknown[] = [];
  /**
   Original runtime owns source execution, retirement, and retained inspection.
   */
  const run = createReachedProgramRun({
    judgment,
    program,
    signal: origin.signal,
    assertParentCurrent,
    dispatchGroup(group) {
      /** Binding completes before native ownership is published. */
      const bound = bindGroup({ tools, origin, carrier, group, assertParentCurrent });
      nativeGroups.set(group.handle, bound);
      /** Settle original execution before rejecting every original member ticket. */
      async function settle(): Promise<void> {
        try { await executeGroup({ origin, program, group, bound, assertParentCurrent }); }
        catch (error) {
          fl.debug('retaining original reached-group execution failure', error);
          failures.push(error);
          for (const ticket of bound.tickets) ticket.reject(error);
        }
      }
      works.push(settle());
      return bound.tickets.map(function readResultTicket(ticket) { return ticket.promise; });
    },
    scriptValueFor({ group, ordinal, outcome }) {
      /** Only an originally bound reached group supplies native result slots. */
      const bound = nativeGroups.get(group);
      if (bound === undefined) throw new Error('Native group has no owned result slots');
      return judgment.scriptValueFor({ group, slot: nonNullishOrThrow(bound.slots[ordinal]), outcome });
    }
  });
  return Object.freeze({
    ...run,
    async drain() {
      fl.debug('draining original runtime and retained native work');
      /**
       Runtime drainage begins before the current native-work snapshot is read.
       */
      const drained = await Promise.allSettled([
        run.drain(),
        ...works
      ]);
      /**
       Failure history is read after all captured work settles, preserving repeated drains.
       */
      const errors = [
        ...failures,
        ...drained.filter(function isRejected(value) { return value.status === 'rejected'; }).map(function readRejection(value) { return value.reason; })
      ];
      if (errors.length > 0) throw new NativeExecutionGuardError({
        errors,
        phase: 'validation',
        toolCallId: origin.prepared.id,
        toolName: origin.prepared.name
      });
      fl.debug('completed original declared program drainage');
    }
  });
}
//endregion
