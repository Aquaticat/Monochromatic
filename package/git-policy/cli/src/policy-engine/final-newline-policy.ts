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
 * @param canApplyPatches - whether current lifecycle accepts policy patches
 *
 * @returns absent or one final-newline finding
 *
 * @example
 * ```ts
 * await checkFinalNewlineCandidate({ candidate, canApplyPatches: false });
 * ```
 */
async function checkFinalNewlineCandidate({
  candidate,
  canApplyPatches,
}: Readonly<{
  candidate: CandidateFile;
  canApplyPatches: boolean;
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
  if (!canApplyPatches)
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
  defaultSeverity: 'warn',
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
     * Exact lifecycle-selected candidates; every lifecycle now supplies only
     * the operation's own delta, so no post-commit narrowing happens here.
     */
    const candidates = await context.git
      .candidates();
    /**
     * Findings accumulated without unbounded candidate-byte fan-out.
     */
    const findings: PolicyFinding[] = [];
    /* oxlint-disable no-await-in-loop -- Sequential candidate reads avoid recreating repository-scale subprocess fan-out for lifecycle facts that are not batch-backed. */
    for (const candidate of candidates)
      findings.push(...await checkFinalNewlineCandidate({
        candidate,
        canApplyPatches: context.canApplyPatches,
      }),);
    /* oxlint-enable no-await-in-loop */
    return findings;
  },
};
