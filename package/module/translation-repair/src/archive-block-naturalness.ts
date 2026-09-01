import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { reviewAbsoluteNaturalness, } from './absolute-naturalness-review-stage.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

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
 * Records defect discovery and distinct acceptance challenge for a retained block.
 *
 * Verdicts are evidence, never withholding authority:
 * a rejection or an unheard review roster becomes located findings on the
 * settlement while the block ships,
 * because reviewer opinion after a completed review round must not pause an
 * entry that a producing stage already settled.
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
 * @returns Findings from both responsibilities, located evidence on rejection
 *
 * @example
 * ```ts
 * const findings = await recordArchiveBlockNaturalness(input);
 * ```
 */
export async function recordArchiveBlockNaturalness(
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
  if ((discovery.verdict === 'acceptable') && (challenge.verdict === 'acceptable'))
    return ['archive block absolute naturalness accepted and challenged',];
  return [
    ...discoveryFindings,
    ...challengeFindings,
    ...(discovery.verdict === 'quorum-not-met'
      ? ['archive naturalness defect-discovery review quorum not met',]
      : []),
    ...(challenge.verdict === 'quorum-not-met'
      ? ['archive naturalness acceptance-challenge review quorum not met',]
      : []),
    'archive block retained with naturalness findings recorded',
  ];
}

//endregion Archive block naturalness
