import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import { admitWithinShortfall, } from '../coverage-corroboration.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { InsertionAdmission, } from '../insertion-admission.ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import { parseDocument, } from '../parse-document.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { droppedDestinations, } from './dropped-destinations.ts';

//region Pass insertion admission
// Production proof for writing source-only passages into a memorial page.
// Coverage is the semantic verdict; page shortfall or a missing destination is
// independent corroboration. Every refusal remains visible to the publication
// completeness guard rather than silently shipping a known gap.

/**
 * One source-only slice proposed by preparation.
 *
 * @example
 * ```ts
 * const candidate: InsertionCandidate = { position: 2, sliceIndex: 4, sourceText: '猫的记录。', };
 * ```
 */
type InsertionCandidate = {
  /**
   * Position in prepared slice order.
   */
  readonly position: number;

  /**
   * Stable slice index recorded in artifacts.
   */
  readonly sliceIndex: number;

  /**
   * Original passage proposed for insertion.
   */
  readonly sourceText: string;
};

/**
 * One source-only slice beside evidence deciding whether it may be translated.
 *
 * @example
 * ```ts
 * const row: InsertionCoverageRow = {
 *   position: 2,
 *   sliceIndex: 4,
 *   sourceText: '猫的记录。',
 *   verdictKind: 'absent',
 *   missingDestinationCount: 0,
 *   coverageFinding: 'insertion-coverage (slice 4)',
 *   stageFindings: [],
 *   destinationFindings: [],
 * };
 * ```
 */
type InsertionCoverageRow = {
  /**
   * Position in prepared slice order.
   */
  readonly position: number;

  /**
   * Stable slice index recorded in artifacts.
   */
  readonly sliceIndex: number;

  /**
   * Original passage the coverage roster searched for.
   */
  readonly sourceText: string;

  /**
   * Semantic verdict from whole-document coverage.
   */
  readonly verdictKind: 'carried' | 'partly-carried' | 'absent' | 'split' | 'inconclusive';

  /**
   * Source destinations this passage carries and target page does not.
   */
  readonly missingDestinationCount: number;

  /**
   * Count-only verdict evidence safe for artifact findings.
   */
  readonly coverageFinding: string;

  /**
   * Lost-voice and quorum findings from coverage stage.
   */
  readonly stageFindings: readonly string[];

  /**
   * Parser downgrade findings from destination comparison.
   */
  readonly destinationFindings: readonly string[];
};

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
      },];
    },);
  if (candidates.length === 0) {
    return {
      positions: new Set(),
      findings: [],
    };
  }

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
  const rows = await mapOverlapped({
    items: candidates,
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
        missingDestinationCount,
        coverageFinding: `insertion-coverage (slice ${String(sliceIndex,)}, verdict ${verdict.kind}, `
          + `full ${String(verdict.anchoredFull,)}, partial ${String(verdict.anchoredPartial,)}, `
          + `absent ${String(verdict.absent,)}, heard ${String(verdict.heard,)} of ${String(verdict.asked,)})`,
        stageFindings,
        destinationFindings: destinations.findings,
      };
    },
  },);

  /**
   * Candidates semantic roster found wholly absent.
   */
  const absent = rows.filter(function absentVerdict(row,): boolean {
    return row.verdictKind === 'absent';
  },);

  /**
   * Absent candidates with no local destination proof, admitted only while
   * whole-page shortfall has budget for them.
   */
  const shortfallPassages = absent
    .filter(function needsShortfall(row,): boolean {
      return row.missingDestinationCount === 0;
    },)
    .map(function toPassage(row,) {
      return {
        where: String(row.position,),
        sourceText: row.sourceText,
      };
    },);
  /**
   * Positions admitted by remaining whole-page shortfall budget.
   */
  const shortfallAdmitted = new Set(
    admitWithinShortfall({
      sourceText: prepared.sourceText,
      targetText: prepared.targetText,
      passages: shortfallPassages,
    },)
      .map(Number,),
  );

  /**
   * Positions backed by semantic absence and either deterministic signal.
   */
  const positions = new Set(
    absent
      .filter(function corroborated(row,): boolean {
        return (row.missingDestinationCount > 0) || shortfallAdmitted.has(row.position,);
      },)
      .map(function toPosition(row,): number {
        return row.position;
      },),
  );

  return {
    positions,
    findings: rows.flatMap(function evidence(row,): readonly string[] {
      return [
        row.coverageFinding,
        `insertion-corroboration (slice ${String(row.sliceIndex,)}, shortfall ${
          shortfallAdmitted.has(row.position,) ? 'admitted' : 'refused'
        }, missing destinations ${String(row.missingDestinationCount,)}, admission ${
          positions.has(row.position,) ? 'admitted' : 'refused'
        })`,
        ...row.stageFindings,
        ...row.destinationFindings,
      ];
    },),
  };
}

//endregion Pass insertion admission
