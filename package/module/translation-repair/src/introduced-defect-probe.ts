import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  buildIntroducedDefectMessages,
  type IntroducedDefectCheckWire,
  INTRODUCED_DEFECT_RESPONSE_FORMAT,
  isIntroducedDefectReportWire,
  type PriorIssueDisclosure,
  type ProbedEditKind,
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
 * Screened claim counts summed across every probed region.
 *
 * Named so the fold that builds it states its own type. Left to the seed
 * literal every count is writable, and the accumulator parameter then reports
 * as mutable in a fold that only ever reads it.
 */
type ClaimTotals = Readonly<{
  /**
   * Claims that a second prober confirmed as added damage.
   */
  corroborated: number;

  /**
   * Claims that a second prober confirmed as dropped content.
   */
  removalCorroborated: number;

  /**
   * Claims the baseline text refuted.
   */
  contradicted: number;

  /**
   * Claims quoting text neither side carries.
   */
  unanchored: number;

  /**
   * Claims restating a defect an accepted issue already named.
   */
  preExisting: number;

  /**
   * Probers that read the region and raised nothing.
   */
  noneFound: number;

  /**
   * Probers that declined to answer.
   */
  uncertain: number;
}>;

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
    editKind = 'accuracy-repair',
    disclosure = 'withheld',
    neighbouringIncumbentText,
    neighbouringSourceText,
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
    readonly editKind?: ProbedEditKind;
    readonly disclosure?: PriorIssueDisclosure;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
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
    editKind,
    disclosure,
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
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
    issues,
  },);

  /**
   * Claims summed across regions, for one readable log line.
   *
   * The accumulator carries an explicit type rather than taking one from the
   * seed literal. An inferred seed makes every count writable, and the rule
   * then reports the fold's own parameter while naming the enclosing function
   * as the origin, which is the signature line rather than anything that
   * produced a value.
   */
  const totals: ClaimTotals = screened.reduce(
    function addRegion(
      running,
      tally,
    ): ClaimTotals {
      return {
        corroborated: running.corroborated + tally.corroborated,
        removalCorroborated: running.removalCorroborated + tally.removalCorroborated,
        contradicted: running.contradicted + tally.contradicted,
        unanchored: running.unanchored + tally.unanchored,
        preExisting: running.preExisting + tally.preExisting,
        noneFound: running.noneFound + tally.noneFound,
        uncertain: running.uncertain + tally.uncertain,
      };
    },
    {
      corroborated: 0,
      removalCorroborated: 0,
      contradicted: 0,
      unanchored: 0,
      preExisting: 0,
      noneFound: 0,
      uncertain: 0,
    } satisfies ClaimTotals,
  );

  // The negative counts belong in the line as much as the positive ones. All
  // claim counts at zero is equally consistent with every prober finding
  // nothing, every prober declining, and every ballot being dropped as a wire
  // fault, and those are three very different states to read a quiet run as.
  l.info(
    `introduced-defect probe: ${String(Object.keys(ballots,)
      .length,)}/${String(proberModelIds.length,)} heard over ${
      String(regions.length,)
    } regions, ${String(totals.corroborated,)} added-damage corroborated, ${
      String(totals.removalCorroborated,)
    } dropped-content corroborated, ${
      String(totals.contradicted,)
    } contradicted by the baseline, ${String(totals.unanchored,)} unanchored, ${
      String(totals.preExisting,)
    } restating an accepted issue, ${
      String(totals.noneFound,)
    } found nothing, ${String(totals.uncertain,)} declined`,
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
