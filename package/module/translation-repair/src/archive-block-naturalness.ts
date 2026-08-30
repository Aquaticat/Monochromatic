import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { reviewAbsoluteNaturalness, } from './absolute-naturalness-review-stage.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';

//region Archive block naturalness

/**
 * Converts located naturalness findings to continuation evidence.
 *
 * @param findings - reviewer findings
 *
 * @returns Prompt-safe evidence without model identity
 */
function describeNaturalnessFindings(
  { findings, }: { readonly findings: readonly {
    readonly paragraph: number;
    readonly problem: string
  }[]; },
): readonly string[] {
  return findings.map(function describe(finding,): string {
    return `archive naturalness paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
  },);
}

/**
 * Requires defect discovery and distinct acceptance challenge for retained block.
 *
 * @param client - provider client
 *
 * @param modelIds - independent review roster
 *
 * @param sourceText - aligned source context
 *
 * @param blockText - exact retained English wording
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - per-call bound
 *
 * @param l - stage logger
 *
 * @returns Findings proving both responsibilities accepted exact block
 *
 * @throws {@link TranslationRepairInterruptedError} when review rejects or cannot reach quorum
 *
 * @example
 * ```ts
 * const findings = await confirmArchiveBlockNaturalness(input);
 * ```
 */
export async function confirmArchiveBlockNaturalness(
  {
    client,
    modelIds,
    sourceText,
    blockText,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly blockText: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<readonly string[]> {
  /**
   * Exact candidate and aligned context shared by distinct reviews.
   */
  const subject = {
    sourceText,
    candidateText: blockText,
    paragraphs: [blockText,],
  };
  /**
   * First responsibility searches for defects.
   */
  const discovery = await reviewAbsoluteNaturalness({
    client,
    modelIds,
    subject,
    perspective: 'defect-discovery',
    signal,
    exchangeTimeoutMs,
    l,
  },);
  /**
   * First-round located evidence.
   */
  const discoveryFindings = describeNaturalnessFindings({ findings: discovery.findings, });
  if (discovery.verdict === 'quorum-not-met') {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings: discoveryFindings,
    },);
  }
  if (discovery.verdict === 'unacceptable') {
    throw new TranslationRepairInterruptedError({
      reason: 'archive-block-unresolved',
      findings: discoveryFindings,
    },);
  }
  /**
   * Distinct responsibility challenges prior acceptance.
   */
  const challenge = await reviewAbsoluteNaturalness({
    client,
    modelIds,
    subject,
    perspective: 'acceptance-challenge',
    signal,
    exchangeTimeoutMs,
    l,
  },);
  /**
   * Second-round located evidence.
   */
  const challengeFindings = describeNaturalnessFindings({ findings: challenge.findings, });
  if (challenge.verdict === 'quorum-not-met') {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings: challengeFindings,
    },);
  }
  if (challenge.verdict === 'unacceptable') {
    throw new TranslationRepairInterruptedError({
      reason: 'archive-block-unresolved',
      findings: challengeFindings,
    },);
  }
  return ['archive block absolute naturalness accepted and challenged',];
}

//endregion Archive block naturalness
