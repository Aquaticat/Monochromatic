/**
 * Repository-owned cli-git policy plugin.
 *
 * @module
 */
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  definePlugin,
  definePolicy,
  type CandidateFile,
  type PluginDefinition,
  type PolicyContext,
  type PolicyDefinition,
  type PolicyFinding,
} from '@monochromatic-dev/git-policy-api/ts';

/**
 * Candidate fields needed by root-context path decision.
 *
 * @example
 * ```ts
 * const candidate: RootContextCandidate = { path: 'CONTEXT.md', change: 'added' };
 * ```
 */
export type RootContextCandidate = Readonly<Pick<CandidateFile, 'path' | 'change'>>;

/**
 * Reports whether candidate state contains non-deleted root context file.
 *
 * @param candidates - exact Git candidates
 *
 * @returns whether root context enters candidate state
 *
 * @example
 * ```ts
 * hasForbiddenRootContext([{ path: 'CONTEXT.md', change: 'added' }]);
 * // => true
 * ```
 */
export function hasForbiddenRootContext(
  candidates: readonly RootContextCandidate[],
): boolean {
  return candidates.some(function isRootContext(candidate,): boolean {
    return (candidate.path === 'CONTEXT.md') && (candidate.change !== 'deleted');
  },);
}

/**
 * Rejects root context-cache files from predicted Git candidate state.
 *
 * @example
 * ```ts
 * forbiddenRootContext.name;
 * // => 'forbidden-root-context'
 * ```
 */
export const forbiddenRootContext: PolicyDefinition<undefined, 'forbidden-root-context'> = definePolicy({
  name: 'forbidden-root-context',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: [
    'pre-forward',
    'direct-check',
  ],
  /**
   * Checks candidate paths against root context-file policy.
   *
   * @param context - Policy context exposing lazy Git facts.
   *
   * @returns findings for forbidden root context file.
   *
   * @mutates context - context.git.candidates may memoize candidate-state loading inside lazy Git facts.
   */
  async check({ context, }: {
    readonly context: ForeignBorrowed<PolicyContext>;
  },): Promise<readonly PolicyFinding[]> {
    /**
     * Exact candidates selected by current Git or direct-check operation.
     */
    const candidates = await context.git
      .candidates();
    if (!hasForbiddenRootContext(candidates,))
      return [];
    return [{
      code: 'root-context-forbidden',
      message: 'Root CONTEXT.md is forbidden; read source code directly.',
      path: 'CONTEXT.md',
    },];
  },
},);

/**
 * Repository policy plugin whose effective namespace remains consumer-owned.
 *
 * @example
 * ```ts
 * repositoryPolicyPlugin.name;
 * // => 'repository'
 * ```
 */
export const repositoryPolicyPlugin: PluginDefinition<
  readonly [typeof forbiddenRootContext],
  'repository'
> = definePlugin({
  name: 'repository',
  policies: [forbiddenRootContext,],
},);
