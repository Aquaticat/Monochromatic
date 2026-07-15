/**
 * Canonical fixed built-in policy registry.
 *
 * @module
 */
import { addExplicitPolicy, } from './add-explicit-policy.ts';
import { branchWorktreePolicy, } from './branch-worktree-policy.ts';
import { finalNewlinePolicy, } from './final-newline-policy.ts';
import { linkedWorktreePolicy, } from './linked-worktree-policy.ts';
import { requireRootPolicy, } from './require-root-policy.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Built-ins in stable execution and configuration order.
 *
 * @example
 * ```ts
 * BUILT_IN_POLICIES.map(({ name }) => name);
 * ```
 */
export const BUILT_IN_POLICIES: readonly RuntimePolicyDefinition[] = [
  requireRootPolicy,
  linkedWorktreePolicy,
  branchWorktreePolicy,
  addExplicitPolicy,
  finalNewlinePolicy,
];
