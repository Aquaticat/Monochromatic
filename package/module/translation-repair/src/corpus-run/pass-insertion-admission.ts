import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { InsertionAdmission, } from '../insertion-admission.ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import { parseDocument, } from '../parse-document.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import { droppedDestinations, } from './dropped-destinations.ts';
import {
  classifyInsertionCoverage,
  type InsertionCandidate,
  type InsertionCoverageRow,
} from './insertion-coverage-model.ts';

//region Pass insertion admission
// Production proof for writing source-only passages into a memorial page.
// Coverage is semantic verdict; page shortfall or missing destination is
// independent corroboration. SINGLE ROUND BY DESIGN: a passage the round
// leaves unresolved is not admitted and not proven carried; it is recorded
// as findings and the page ships without it, because inserting on
// uncorroborated evidence duplicates carried content while a recorded gap
// stays visible to the publisher's destination report and the reading
// (doc/planning/translation-repair-no-loop-design.md). Only an unheard
// roster still throws, as infrastructure failure.

/**
 * Decides which source-only slices a corpus pass may ask translators to fill.
 *
 * @param client - provider client shared with pass stages
 *
 * @param prepared - one source/target preparation carrying insertion slices
 *
 * @param modelIds - measured production coverage roster
 *
 * @param overlap - most coverage questions in flight
 *
 * @param signal - entry deadline and caller abort
 *
 * @param perCallTimeoutMs - deadline per coverage exchange
 *
 * @param l - entry logger
 *
 * @returns Admitted positions and count-only evidence for every candidate
 *
 * @throws {@link TranslationRepairInterruptedError}
 * when no coverage voice was heard for some passage
 *
 * @example
 * ```ts
 * const admission = await decidePassInsertionAdmission({ client, prepared, modelIds, overlap: 4, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function decidePassInsertionAdmission(
  {
    client,
    prepared,
    modelIds,
    overlap,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly modelIds: readonly RosterModelId[];
    readonly overlap: number;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<InsertionAdmission> {
  /**
   * Source-only slices, in document order.
   */
  const candidates: readonly InsertionCandidate[] = prepared
    .slices
    .flatMap(function toCandidate(
      slice,
      position,
    ): readonly InsertionCandidate[] {
      /**
       * Placement on target side.
       */
      const { target, } = slice;
      if (!isInsertionChunk(target,))
        return [];
      /**
       * Source passage paired with that placement.
       */
      const { source, } = slice;
      return [{
        position,
        sliceIndex: target.sliceIndex,
        sourceText: source.text,
        frontMatter: slice.syntax === 'front-matter',
      },];
    },);
  if (candidates.length === 0) {
    return {
      positions: new Set(),
      findings: [],
    };
  }

  /**
   * Metadata insertion positions admitted by explicit syntax role.
   */
  const frontMatterPositions = new Set(candidates
    .filter(function isFrontMatter(candidate,): boolean {
      return candidate.frontMatter;
    },)
    .map(function positionOf(candidate,): number {
      return candidate.position;
    },),);
  /**
   * Prose candidates requiring semantic coverage proof.
   */
  const semanticCandidates = candidates.filter(function isProse(candidate,): boolean {
    return !candidate.frontMatter;
  },);

  /**
   * Target parsed once so every coverage quote anchors against one document.
   */
  const target = parseDocument({ text: prepared.targetText, },);

  /**
   * Logger marking admission as one stage beneath entry.
   */
  const al = tagged({
    tag: decidePassInsertionAdmission.name,
    l,
  },);

  /**
   * Semantic and destination evidence per source-only slice.
   */
  const initialRows = await mapOverlapped({
    items: semanticCandidates,
    overlap,
    oneItem: async function readCandidate({ item: candidate, },): Promise<InsertionCoverageRow> {
      /**
       * Candidate fields used by both evidence readers.
       */
      const {
        sliceIndex,
        sourceText,
      } = candidate;

      /**
       * Whether this passage carries a destination absent from whole target.
       */
      const destinations = droppedDestinations({
        sourceText,
        pageText: prepared.targetText,
      },);
      /**
       * Missing source destinations counted without exposing their values.
       */
      const missingDestinationCount = destinations
        .dropped
        .length;

      /**
       * Roster verdict independent of pairing and shortfall.
       */
      const answer = await runCoverageStage({
        client,
        modelIds,
        sourcePassage: sourceText,
        translation: target,
        signal,
        exchangeTimeoutMs: perCallTimeoutMs,
        l: al,
      },);
      /**
       * Coverage result fields persisted as counts and findings.
       */
      const {
        verdict,
        findings: stageFindings,
      } = answer;
      al.info(
        `slice ${String(sliceIndex,)}: coverage=${verdict.kind}, `
          + `missingDestinations=${String(missingDestinationCount,)}`,
      );
      return {
        ...candidate,
        verdictKind: verdict.kind,
        anchoredFull: verdict.anchoredFull,
        anchoredPartial: verdict.anchoredPartial,
        absentCount: verdict.absent,
        heard: verdict.heard,
        asked: verdict.asked,
        missingDestinationCount,
        coverageFinding: `insertion-coverage (slice ${String(sliceIndex,)}, verdict ${verdict.kind}, `
          + `full ${String(verdict.anchoredFull,)}, partial ${String(verdict.anchoredPartial,)}, `
          + `absent ${String(verdict.absent,)}, heard ${String(verdict.heard,)} of ${String(verdict.asked,)})`,
        stageFindings,
        coverageEvidence: verdict.evidence,
        destinationFindings: destinations.findings,
      };
    },
  },);

  // An unheard roster is infrastructure failure, never a quality refusal;
  // masking it as an unresolved recording would freeze an outage into the page.
  for (const row of initialRows) {
    if (row.heard === 0) {
      throw new TranslationRepairInterruptedError({
        reason: 'provider-unavailable',
        findings: [row.coverageFinding,],
      },);
    }
  }
  /**
   * Single-round resolution of every candidate.
   */
  const classification = classifyInsertionCoverage({
    candidates,
    rows: initialRows,
    frontMatterPositions,
    sourceText: prepared.sourceText,
    targetText: prepared.targetText,
  },);
  for (const row of classification.unresolvedRows) {
    al.info(
      `slice ${String(row.sliceIndex,)}: placement unresolved after the single round `
        + `(verdict ${row.verdictKind}); not admitted, recorded as findings`,
    );
  }
  return {
    positions: classification.positions,
    carried: classification.carried,
    findings: [
      ...classification.findings,
      ...classification.unresolvedRows
        .map(function unresolvedFinding(row,): string {
          return `insertion-unresolved-after-single-round (slice ${String(row.sliceIndex,)}, `
            + `verdict ${row.verdictKind}); passage not admitted`;
        },),
    ],
  };
}
//endregion Pass insertion admission
