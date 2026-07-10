/**
 * Unified branch-worktree-only built-in policy. @module
 */
import type { PolicyFinding, } from '../api/policy-types.ts';
import {
  checkBranchWorktree,
  BranchWorktreeViolationError,
} from './branch-worktree-check.ts';
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
  check: async function runBranchWorktreePolicy({ context, }): Promise<readonly PolicyFinding[]> {
    try {
      await checkBranchWorktree(context.command
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
