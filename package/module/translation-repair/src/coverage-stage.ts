import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type CoverageVerdict,
  judgeCoverage,
} from './coverage-verdict.ts';
import {
  buildCoverageMessages,
  COVERAGE_RESPONSE_FORMAT,
  type CoverageReportWire,
  isCoverageReportWire,
} from './coverage-wire.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { AnchorTarget, } from './validate-issue.ts';

//region Coverage stage
// Asks a roster whether a translation already carries one passage, and reports
// what they proved rather than what they said.
//
// NOTHING CALLS THIS YET. It exists to answer question 28 with a measurement:
// the four ways out of `#106` differ in expense rather than in correctness, and
// only one of them can be evaluated before it is chosen. `coverage-probe.ts`
// runs it over the corpus candidates that the two aligners disagree about.

/**
 * What one coverage question cost and concluded.
 *
 * @example
 * ```ts
 * const answer: CoverageAnswer = { verdict, findings: [], };
 * ```
 */
export type CoverageAnswer = {
  /**
   * Verdict over the anchored replies.
   */
  readonly verdict: CoverageVerdict;

  /**
   * Roster findings: lost voices and incomplete rosters, which arrive whether
   * or not quorum was met, so this being empty means nothing went wrong rather
   * than that enough models answered.
   */
  readonly findings: readonly string[];
};

/**
 * Asks one roster whether a translation carries one passage.
 *
 * @param client - injected model client
 *
 * @param modelIds - roster asked
 *
 * @param sourcePassage - original-side text whose coverage is in question
 *
 * @param translation - whole translation, searched and used to anchor quotes
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param l - logger of the calling driver
 *
 * @returns Verdict plus any roster findings
 *
 * @example
 * ```ts
 * const answer = await runCoverageStage({ client, modelIds, sourcePassage, translation, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function runCoverageStage(
  {
    client,
    modelIds,
    sourcePassage,
    translation,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly SyntheticModelId[];
    readonly sourcePassage: string;
    readonly translation: AnchorTarget;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<CoverageAnswer> {
  /**
   * Sheet asking about this passage against the whole translation.
   */
  const plan = buildCoverageMessages({
    sourcePassage,
    translationText: translation.text,
  },);

  /**
   * Replies heard from the roster.
   */
  const gather = await gatherStageVoices<CoverageReportWire>({
    client,
    modelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs,
    responseFormat: COVERAGE_RESPONSE_FORMAT,
    validate: isCoverageReportWire,
    stage: 'coverage',
    l,
  },);
  return {
    verdict: judgeCoverage({
      voices: gather.voices,
      document: translation,
      asked: modelIds.length,
      quorumMet: gather.quorumMet,
    },),
    findings: gather.findings,
  };
}

//endregion Coverage stage
