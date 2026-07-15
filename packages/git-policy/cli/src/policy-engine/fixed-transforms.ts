/**
 * Fixed non-configurable command-transform stage.
 *
 * @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { atomicPush, } from '../rule/atomic-push.ts';
import {
  commitOnly,
  CommitOnlyViolationError,
  hasCommitOnlyEscapeHatch,
} from '../rule/commit-only.ts';
import { statusHintsOff, } from '../rule/status-hints-off.ts';
import {
  createCoreFindingEvent,
  createEngineFailureEvent,
  type PolicyEvent,
} from './events.ts';

/**
 * Fixed-transform dependencies exposed for deterministic failure tests.
 */
export type FixedTransformDependencies = {
  /**
   * Atomic-push transform.
   */
  readonly atomicPush: typeof atomicPush;
  /**
   * Commit-only transform.
   */
  readonly commitOnly: typeof commitOnly;
  /**
   * Commit escape detector.
   */
  readonly hasCommitOnlyEscapeHatch: typeof hasCommitOnlyEscapeHatch;
  /**
   * Status-hints transform.
   */
  readonly statusHintsOff: typeof statusHintsOff;
};

/**
 * Canonical production fixed-transform dependencies.
 */
export const FIXED_TRANSFORM_DEPENDENCIES: FixedTransformDependencies = {
  atomicPush,
  commitOnly,
  hasCommitOnlyEscapeHatch,
  statusHintsOff,
};

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
 * @param rawArgs - exact invocation arguments retained across passes
 *
 * @param sequence - sequence for any emitted event
 *
 * @param dependencies - injectable fixed transforms for deterministic tests
 *
 * @returns transformed arguments and structured fixed-core outcome
 *
 * @example
 * ```ts
 * await applyFixedTransforms({ args: ['push', 'origin', 'main'], rawArgs: ['push', 'origin', 'main'], sequence: 0 });
 * ```
 */
export async function applyFixedTransforms({
  args,
  rawArgs,
  sequence,
  dependencies = FIXED_TRANSFORM_DEPENDENCIES,
}: Readonly<{
  args: readonly string[];
  rawArgs: readonly string[];
  sequence: number;
  dependencies?: FixedTransformDependencies;
}>,): Promise<FixedTransformResult> {
  try {
    /**
     * Atomic-push output passed to commit-only.
     */
    const atomicArgs = dependencies.atomicPush(args,);
    /**
     * Whether prior pass already stripped invocation-wide commit escape.
     */
    const retainedCommitEscape = dependencies.hasCommitOnlyEscapeHatch(rawArgs,)
      && (!dependencies.hasCommitOnlyEscapeHatch(atomicArgs,));
    /**
     * Commit-only output passed to status-hints-off.
     */
    const commitArgs = retainedCommitEscape
      ? atomicArgs
      : await dependencies.commitOnly(atomicArgs,);
    return {
      args: dependencies.statusHintsOff(commitArgs,),
      events: [],
      complete: true,
    };
  }
  catch (error: unknown) {
    if (error instanceof CommitOnlyViolationError) {
      return {
        args,
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
      args,
      events: [createEngineFailureEvent({
        sequence,
        code: 'core-incomplete',
        message: caughtValueText(error,),
      },),],
      complete: false,
    };
  }
}
