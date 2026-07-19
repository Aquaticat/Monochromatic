/**
 * Goal lifecycle runtime contracts and nondeterministic defaults.
 *
 * @module
 */

import { randomUUID, } from 'node:crypto';

import type {
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  GoalControllerState,
  GoalControllerTransition,
} from './types.ts';

/**
 * Injectable nondeterministic lifecycle services.
 */
type GoalLifecycleServices = {
  /**
   * Mint unique run, generation, runtime, and message identities.
   */
  readonly createId: () => string;

  /**
   * Read current ISO timestamp.
   */
  readonly now: () => string;
};

/**
 * Shared runtime boundary used by completion-review registration.
 */
type GoalLifecycleHandle = {
  /**
   * Read current immutable controller snapshot.
   */
  readonly currentController: () => GoalControllerState;

  /**
   * Commit pure transition and execute ordered Pi effects.
   */
  readonly applyTransition: (
    input: {
      readonly transition: GoalControllerTransition;
      readonly context: ForeignBorrowed<ExtensionContext>;
    },
  ) => void;
};

/**
 * Default cryptographically unique lifecycle identity source.
 *
 * @returns UUID identity
 *
 * @example
 * ```ts
 * defaultCreateId();
 * ```
 */
function defaultCreateId(): string {
  return randomUUID();
}

/**
 * Default wall-clock source for persisted transition timestamps.
 *
 * @returns current ISO timestamp
 *
 * @example
 * ```ts
 * defaultNow();
 * ```
 */
function defaultNow(): string {
  return new Date().toISOString();
}

export {
  defaultCreateId,
  defaultNow,
};
export type {
  GoalLifecycleHandle,
  GoalLifecycleServices,
};
