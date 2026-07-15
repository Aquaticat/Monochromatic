/**
 * Unified linked-worktree-only built-in policy. @module
 */
import type { PolicyFinding, } from '../api/policy-types.ts';
import {
  checkLinkedWorktree,
  LinkedWorktreeViolationError,
} from './linked-worktree-check.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Configurable linked-worktree-only policy.
 *
 * @example
 * ```ts
 * linkedWorktreePolicy.name;
 * ```
 */
export const linkedWorktreePolicy: RuntimePolicyDefinition = {
  name: 'linked-worktree-only',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['pre-forward',],
  check: async function runLinkedWorktreePolicy({ context, }): Promise<readonly PolicyFinding[]> {
    try {
      await checkLinkedWorktree(context.command
        .transformedArgs,);
      return [];
    }
    catch (error: unknown) {
      if (error instanceof LinkedWorktreeViolationError) {
        return [{
          code: 'linked-worktree-required',
          message: error.message,
        },];
      }
      throw error;
    }
  },
};
