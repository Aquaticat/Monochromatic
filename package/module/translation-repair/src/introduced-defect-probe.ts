import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  buildIntroducedDefectMessages,
  type IntroducedDefectCheckWire,
  INTRODUCED_DEFECT_RESPONSE_FORMAT,
  isIntroducedDefectReportWire,
} from './introduced-defect-wire.ts';
import {
  type RegionDefectTally,
  screenIntroducedDefects,
} from './introduced-defect-screen.ts';
import type { RepairRegion, } from './repair-region.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Introduced-defect probe stage
// Asks whether the repair broke anything nobody had raised. Runs in SHADOW
// MODE: the report reaches the outcome and the artifacts, and nothing reads it
// to decide what ships. That is deliberate and is the whole point of this
// revision. The stage's own failure mode, a prober re-reporting the defect the
// edit was fixing, has no measured rate yet, and wiring an unmeasured stage
// into selection would let one false claim discard every repair in a chunk
// including the ones in other envelopes. Round three's artifacts plus the
// human repair grades are what will measure it.

/**
 * Everything the probe stage produced for one chunk.
 *
 * @example
 * ```ts
 * const { regions, } = await runIntroducedDefectProbe({ ... },);
 * ```
 */
export type IntroducedDefectReport = {
  /**
   * Screened tally per replaced region, in region order.
   */
  readonly regions: readonly RegionDefectTally[];

  /**
   * Probers whose reply arrived and validated.
   */
  readonly heardProbers: number;

  /**
   * Probers asked. Kept beside the heard count because a claim confirmed by
   * two of three heard probers and one confirmed by two of six configured are
   * different evidence, and only the pair distinguishes them.
   */
  readonly configuredProbers: number;

  /**
   * Wire irregularities across probers in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Report of a probe that never ran, for chunks with nothing replaced.
 */
export const EMPTY_INTRODUCED_DEFECT_REPORT: IntroducedDefectReport = {
  regions: [],
  heardProbers: 0,
  configuredProbers: 0,
  findings: [],
};

/**
 * Asks whether each replaced region introduced a defect the baseline lacked.
 *
 * @param client - injected model client
 *
 * @param proberModelIds - roster asked, writer-disjoint like the checkers
 *
 * @param sourceText - original chunk text
 *
 * @param baselineText - translation before any replacement
 *
 * @param regions - regions the accuracy stage replaced
 *
 * @param issues - accepted issues, shown so probers can discount them
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Screened tallies plus roster accounting
 *
 * @example
 * ```ts
 * const probe = await runIntroducedDefectProbe({ ... },);
 * ```
 */
export async function runIntroducedDefectProbe(
  {
    client,
    proberModelIds,
    sourceText,
    baselineText,
    regions,
    issues,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly proberModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly baselineText: string;
    readonly regions: readonly RepairRegion[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<IntroducedDefectReport> {
  if (regions.length === 0)
    return EMPTY_INTRODUCED_DEFECT_REPORT;

  /**
   * Prober sheet plus the region numbering order.
   */
  const plan = buildIntroducedDefectMessages({
    sourceText,
    baselineText,
    regions,
    issues,
  },);

  /**
   * Heard probers after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: proberModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: INTRODUCED_DEFECT_RESPONSE_FORMAT,
    validate: isIntroducedDefectReportWire,
    stage: 'introduced-defect-probe',
    l,
  },);

  /**
   * Checks per prober, keyed by model id.
   */
  const ballots: Record<string, readonly IntroducedDefectCheckWire[]> = Object.fromEntries(
    gather.voices
      .map(function toEntry(voice,): readonly [
        string,
        readonly IntroducedDefectCheckWire[],
      ] {
      return [
        voice.modelId,
        voice.value
          .checks,
      ];
    },),
  );

  /**
   * Screened tally per region.
   */
  const screened = screenIntroducedDefects({
    regions,
    ballots,
  },);

  /**
   * Claims summed across regions, for one readable log line.
   */
  const totals = screened.reduce(
    function addRegion(
      running,
      tally,
    ) {
      return {
        corroborated: running.corroborated + tally.corroborated,
        contradicted: running.contradicted + tally.contradicted,
        unanchored: running.unanchored + tally.unanchored,
      };
    },
    {
      corroborated: 0,
      contradicted: 0,
      unanchored: 0,
    },
  );

  l.info(
    `introduced-defect probe: ${String(Object.keys(ballots,)
      .length,)}/${String(proberModelIds.length,)} heard over ${
      String(regions.length,)
    } regions, ${String(totals.corroborated,)} corroborated, ${
      String(totals.contradicted,)
    } contradicted by the baseline, ${String(totals.unanchored,)} unanchored`,
  );

  return {
    regions: screened,
    heardProbers: Object.keys(ballots,)
      .length,
    configuredProbers: proberModelIds.length,
    findings: gather.findings,
  };
}

//endregion Introduced-defect probe stage
