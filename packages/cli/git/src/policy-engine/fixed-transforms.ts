/**
 * Fixed non-configurable command-transform stage.
 *
 * @module
 */
import { atomicPush, } from '../rules/atomic-push.ts';
import {
  commitOnly,
  CommitOnlyViolationError,
} from '../rules/commit-only.ts';
import { statusHintsOff, } from '../rules/status-hints-off.ts';
import {
  createCoreFindingEvent,
  createEngineFailureEvent,
  type PolicyEvent,
} from './events.ts';

/**
 * Result from one fixed-transform stage.
 */
export type FixedTransformResult = Readonly<{
  /**
   * Final transformed arguments or last safe intermediate arguments.
   */
  args: readonly string[];
  /**
   * Empty success events or one structured rejection/failure.
   */
  events: readonly PolicyEvent[];
  /**
   * Whether plugin policy stage may continue.
   */
  complete: boolean;
}>;

/**
 * Applies fixed transforms in canonical order.
 *
 * @param args - wrapper-control-clean command arguments
 *
 * @param sequence - sequence for any emitted event
 *
 * @returns transformed arguments and structured fixed-core outcome
 *
 * @example
 * ```ts
 * await applyFixedTransforms({ args: ['push', 'origin', 'main'], sequence: 0 });
 * ```
 */
export async function applyFixedTransforms({
  args,
  sequence,
}: Readonly<{
  args: readonly string[];
  sequence: number;
}>,): Promise<FixedTransformResult> {
  /**
   * Atomic-push output passed to commit-only.
   */
  const atomicArgs = atomicPush(args,);
  try {
    /**
     * Commit-only output passed to status-hints-off.
     */
    const commitArgs = await commitOnly(atomicArgs,);
    return {
      args: statusHintsOff(commitArgs,),
      events: [],
      complete: true,
    };
  }
  catch (error: unknown) {
    if (error instanceof CommitOnlyViolationError) {
      return {
        args: atomicArgs,
        events: [createCoreFindingEvent({
          sequence,
          coreId: 'commit-only',
          code: error.code,
          message: error.message,
        },),],
        complete: true,
      };
    }
    return {
      args: atomicArgs,
      events: [createEngineFailureEvent({
        sequence,
        code: 'core-incomplete',
        message: Error.isError(error,) ? error.message : String(error,),
      },),],
      complete: false,
    };
  }
}
