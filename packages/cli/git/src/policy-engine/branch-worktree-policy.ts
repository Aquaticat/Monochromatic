/**
 * Unified branch-worktree-only built-in policy. @module
 */
import type { PolicyFinding, } from '../api/policy-types.ts';
import {
  branchWorktreeOnly,
  BranchWorktreeViolationError,
} from '../rules/branch-worktree-only.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Configurable branch-worktree-only policy.
 *
 * @example
 * ```ts
 * branchWorktreePolicy.name;
 * ```
 */
export const branchWorktreePolicy: RuntimePolicyDefinition = {
  name: 'branch-worktree-only',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward',],
  check: async function checkBranchWorktree({ context, }): Promise<readonly PolicyFinding[]> {
    try {
      await branchWorktreeOnly(context.command
        .transformedArgs,);
      return [];
    }
    catch (error: unknown) {
      if (error instanceof BranchWorktreeViolationError) {
        return [{
          code: 'branch-creation-requires-worktree',
          message: error.message,
        },];
      }
      throw error;
    }
  },
};
