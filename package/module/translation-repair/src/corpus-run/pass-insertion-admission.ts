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
import { droppedDestinations, } from './dropped-destinations.ts';
import {
  classifyInsertionCoverage,
  type InsertionCandidate,
  type InsertionCoverageRow,
} from './insertion-coverage-model.ts';
import { repairInsertionCoverageRow, } from './insertion-coverage-repair.ts';

//region Pass insertion admission
// Production proof for writing source-only passages into a memorial page.
// Coverage is semantic verdict; page shortfall or missing destination is
// independent corroboration. Unresolved placement pauses before lanes rather
// than becoming unfilled quality result at publication boundary.

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
 * @throws {@link import('../translation-repair-interrupted-error.ts').TranslationRepairInterruptedError}
 * when source-only prose
 * placement remains unresolved
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

  /**
   * Canonical unresolved placement tasks already attempted per candidate.
   */
  const attemptedPlacementTasks = new Set<string>();
  {
    /**
     * Latest row per candidate, replaced only by distinct follow-up evidence.
     */
    let rows = initialRows;
    while (!signal.aborted) {
      /**
       * Current inserted, carried, and unresolved classifications.
       */
      const classification = classifyInsertionCoverage({
        candidates,
        rows,
        frontMatterPositions,
        sourceText: prepared.sourceText,
        targetText: prepared.targetText,
      },);
      /**
       * Current classification fields used in this iteration.
       */
      const {
        positions,
        carried,
        unresolvedRows,
        shortfallAdmitted,
        findings,
      } = classification;
      /**
       * Unresolved passage count safe for operational log.
       */
      const unresolvedCount = unresolvedRows.length;
      if (unresolvedCount === 0) {
        return {
          positions,
          carried,
          findings,
        };
      }
      al.info(
        `continuing insertion placement repair for ${String(unresolvedCount,)} source passages`,
      );
      /* oxlint-disable no-await-in-loop -- each placement task depends on latest unresolved verdict */
      /**
       * Follow-up coverage rows for currently unresolved candidates.
       */
      const repairedRows = await mapOverlapped({
        items: unresolvedRows,
        overlap,
        oneItem: async function repairPlacement({ item: row, },): Promise<InsertionCoverageRow> {
          return await repairInsertionCoverageRow({
            client,
            modelIds,
            row,
            target,
            shortfallAdmitted: shortfallAdmitted.has(row.position,),
            attemptedTasks: attemptedPlacementTasks,
            priorFindings: findings,
            signal,
            exchangeTimeoutMs: perCallTimeoutMs,
            l: al,
          },);
        },
      },);
      /* oxlint-enable no-await-in-loop */
      /**
       * Latest repaired row by prepared position.
       */
      const repairedByPosition = new Map(repairedRows.map(function repairedEntry(row,) {
        return [
          row.position,
          row,
        ] as const;
      },),);
      rows = rows.map(function replaceRepaired(row,): InsertionCoverageRow {
        return repairedByPosition.get(row.position,) ?? row;
      },);
    }
  }
  throw signal.reason;
}

//endregion Pass insertion admission
