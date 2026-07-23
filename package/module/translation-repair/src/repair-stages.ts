import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  AdjudicatedIssue,
  AdjudicationConfig,
  PanelBallot,
} from './adjudicate-model.ts';
import { buildAdjudicationMessages, } from './adjudicate-prompt.ts';
import {
  ADJUDICATION_RESPONSE_FORMAT,
  isPanelBallotWire,
  resolvePanelBallot,
} from './adjudicate-wire.ts';
import type { ClaimCluster, } from './aggregate-claims.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { buildCriticMessages, } from './critic-prompt.ts';
import {
  CRITIC_RESPONSE_FORMAT,
  isCriticReportWire,
  resolveCriticIssue,
} from './critic-wire.ts';
import type {
  DocumentSide,
  IssueClaim,
} from './issue-model.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import { tallyVotes, } from './tally-votes.ts';
import type { AnchorTarget, } from './validate-issue.ts';

//region Critic and panel stages
// The two claim-producing stages of one chunk's repair: critics fan out and
// their validated claims come back, then a provenance-blind panel judges the
// aggregated clusters. A lost voice never fails the stage; the ensemble is
// built from individually unreliable models.

/**
 * Everything the critic fan-out produced for one chunk.
 *
 * @example
 * ```ts
 * const { claims, nonTranslationVotes, } = await runCriticStage({ ... },);
 * ```
 */
export type CriticStageResult = {
  /**
   * Validated claims across every heard critic, in critic then report order.
   */
  readonly claims: readonly IssueClaim[];

  /**
   * Critics reporting a critical non-translation at wire level;
   * anchoring is best-effort for such pairs, so this count is taken
   * before anchor resolution.
   */
  readonly nonTranslationVotes: number;

  /**
   * Critics whose reply arrived and validated.
   */
  readonly heardCritics: number;

  /**
   * Resolution failures in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the critic fan-out for one chunk pair.
 *
 * @param client - injected model client
 *
 * @param criticModelIds - critics to fan out to
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text
 *
 * @param documents - parsed chunk pair claims anchor against
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Validated claims plus wire-level non-translation votes
 *
 * @example
 * ```ts
 * const critic = await runCriticStage({ ... },);
 * ```
 */
export async function runCriticStage(
  {
    client,
    criticModelIds,
    sourceText,
    targetText,
    documents,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly criticModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly documents: Readonly<Record<DocumentSide, AnchorTarget>>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<CriticStageResult> {
  /**
   * Shared critic prompt for this chunk.
   */
  const messages = buildCriticMessages({
    sourceText,
    targetText,
  },);

  /**
   * Heard critics after full-roster retries: the critic union is the
   * product, and measured convergence is low (67 to 84 percent
   * singleton issues on real corpus entries), so every unheard voice
   * would cost its findings nearly one-for-one.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: criticModelIds,
    messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: CRITIC_RESPONSE_FORMAT,
    validate: isCriticReportWire,
    stage: 'critic',
    l,
    retryTarget: 'full-roster',
  },);

  /**
   * Reports that actually arrived.
   */
  const reports = gather.voices
    .map(function toReport(voice,) {
    return voice.value;
  },);

  /**
   * Critics reporting a critical non-translation before anchoring;
   * degenerate pairs defeat anchoring, so the wire level is the honest one.
   */
  const nonTranslationVotes = reports.filter(function votesNonTranslation(report,) {
    return report.issues
      .some(function isCriticalNonTranslation(issue,) {
      return (issue.category === 'accuracy/non-translation')
        && (issue.severity === 'critical');
    },);
  },)
    .length;

  /**
   * Findings accumulated across resolutions, seeded with quorum
   * degradation findings from the gather.
   */
  const findings: string[] = [...gather.findings,];

  /**
   * Validated claims across every report.
   */
  const claims = reports.flatMap(function resolveReport(report,) {
    return report.issues
      .flatMap(function resolveOne(wire,): readonly IssueClaim[] {
      /**
       * Resolution of this wire issue.
       */
      const resolution = resolveCriticIssue({
        wire,
        documents,
      },);
      if (!resolution.resolved) {
        findings.push(resolution.reason,);
        return [];
      }
      return [resolution.claim,];
    },);
  },);

  l.info(
    `critic stage: ${String(reports.length,)}/${String(criticModelIds.length,)} heard, ${
      String(claims.length,)
    } claims, ${String(nonTranslationVotes,)} non-translation votes`,
  );

  return {
    claims,
    nonTranslationVotes,
    heardCritics: reports.length,
    findings,
  };
}

/**
 * Everything the panel produced for one chunk.
 *
 * @example
 * ```ts
 * const { issues, } = await runPanelStage({ ... },);
 * ```
 */
export type PanelStageResult = {
  /**
   * Adjudicated issues in cluster document order.
   */
  readonly issues: readonly AdjudicatedIssue[];

  /**
   * Panelists whose ballot arrived and validated.
   */
  readonly heardPanelists: number;

  /**
   * Ballot irregularities across panelists in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the provenance-blind panel over one chunk's clusters.
 *
 * @param client - injected model client
 *
 * @param panelModelIds - fixed electorate
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text critics reviewed
 *
 * @param clusters - aggregation output for the chunk
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Adjudicated issues plus ballot findings
 *
 * @example
 * ```ts
 * const panel = await runPanelStage({ ... },);
 * ```
 */
export async function runPanelStage(
  {
    client,
    panelModelIds,
    sourceText,
    targetText,
    clusters,
    adjudicationConfig,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly panelModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly clusters: readonly ClaimCluster[];
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<PanelStageResult> {
  /**
   * Panel sheet plus the index maps ballots resolve through.
   */
  const plan = buildAdjudicationMessages({
    sourceText,
    targetText,
    clusters,
  },);

  /**
   * Heard panelists after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: panelModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: ADJUDICATION_RESPONSE_FORMAT,
    validate: isPanelBallotWire,
    stage: 'panel',
    l,
  },);

  /**
   * Resolved ballots keyed by panelist id.
   */
  const ballots: Record<string, PanelBallot> = Object.fromEntries(
    gather.voices
      .map(function toEntry(voice,): readonly [
        string,
        PanelBallot,
      ] {
      return [
        voice.modelId,
        resolvePanelBallot({
          wire: voice.value,
          claimIds: plan.claimIds,
          clusterIds: plan.clusterIds,
        },),
      ];
    },),
  );

  /**
   * Quorum degradation plus ballot irregularities across heard panelists.
   */
  const findings = [
    ...gather.findings,
    ...Object
      .values(ballots,)
      .flatMap(function toFindings(ballot,) {
        return ballot.findings;
      },),
  ];

  /**
   * Panel decision over the clusters.
   */
  const { issues, } = tallyVotes({
    clusters,
    ballots,
    ...(adjudicationConfig === undefined ? {} : { config: adjudicationConfig, }),
  },);

  l.info(
    `panel stage: ${String(Object.keys(ballots,)
      .length,)}/${String(panelModelIds.length,)} heard, ${
      String(issues.length,)
    } issues`,
  );

  return {
    issues,
    heardPanelists: Object.keys(ballots,)
      .length,
    findings,
  };
}

//endregion Critic and panel stages
