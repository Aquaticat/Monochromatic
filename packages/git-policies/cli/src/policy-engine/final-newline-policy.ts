/**
 * Core final-newline policy.
 *
 * @module
 */
import type {
  CandidateFile,
  PolicyFinding,
} from '../api/policy-types.ts';
import {
  normalizeFinalNewline,
  isFinalNewlineExcluded,
} from './final-newline-normalize.ts';
import { createFinalNewlinePatch, } from './final-newline-patch.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Evaluates one content-bearing ordinary candidate.
 *
 * @param candidate - exact lifecycle candidate
 *
 * @param fixable - whether current lifecycle accepts policy patches
 *
 * @returns absent or one final-newline finding
 *
 * @example
 * ```ts
 * await checkFinalNewlineCandidate({ candidate, fixable: false });
 * ```
 */
async function checkFinalNewlineCandidate({
  candidate,
  fixable,
}: Readonly<{
  candidate: CandidateFile;
  fixable: boolean;
}>,): Promise<readonly PolicyFinding[]> {
  if ((candidate.change === 'deleted')
    || ((candidate.mode !== 'regular') && (candidate.mode !== 'executable'))
    || isFinalNewlineExcluded(candidate.path,))
    return [];
  /**
   * Exact candidate bytes from lifecycle-owned Git state.
   */
  const original = await candidate.bytes();
  /**
   * Exact-byte normalization decision.
   */
  const normalization = normalizeFinalNewline(original,);
  if (normalization.kind === 'unchanged')
    return [];
  /**
   * Stable report shared by read-only and fixable lifecycle points.
   */
  const finding: PolicyFinding = {
    code: 'noncanonical-final-newline',
    message: 'Non-empty text file must end with exactly one LF byte.',
    path: candidate.path,
  };
  if (!fixable)
    return [finding,];
  if ((typeof candidate.revision) === 'symbol')
    throw new TypeError(`Final-newline patch target is mutable: ${candidate.path}`,);
  return [{
    ...finding,
    patch: createFinalNewlinePatch({
      targetId: candidate.targetId,
      path: candidate.path,
      revision: candidate.revision,
      mode: candidate.mode,
      original,
      replacement: normalization.bytes,
    },),
  },];
}

/**
 * Enabled-by-default core final-newline policy.
 *
 * @example
 * ```ts
 * finalNewlinePolicy.name;
 * // => 'final-newline'
 * ```
 */
export const finalNewlinePolicy: RuntimePolicyDefinition = {
  name: 'final-newline',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: [
    'pre-forward',
    'post-commit',
    'manual-push',
    'direct-check',
    'direct-fix',
  ],
  async check({ context, }): Promise<readonly PolicyFinding[]> {
    /**
     * Whether engine may apply corrections at this lifecycle point.
     */
    const fixable = (context.trigger === 'pre-forward') || (context.trigger === 'direct-fix');
    /**
     * Exact selected candidates, limited to landed delta after commit.
     */
    const candidates = (await context.git
      .candidates())
      .filter(function isRelevantCandidate(candidate,) {
        return (context.trigger !== 'post-commit') || (candidate.change !== 'unchanged');
      },);
    /**
     * Findings accumulated without unbounded candidate-byte fan-out.
     */
    const findings: PolicyFinding[] = [];
    /* oxlint-disable no-await-in-loop -- Sequential candidate reads avoid recreating repository-scale subprocess fan-out for lifecycle facts that are not batch-backed. */
    for (const candidate of candidates)
      findings.push(...await checkFinalNewlineCandidate({
        candidate,
        fixable,
      }),);
    /* oxlint-enable no-await-in-loop */
    return findings;
  },
};
