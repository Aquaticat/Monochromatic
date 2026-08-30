import { admitWithinShortfall, } from '../coverage-corroboration.ts';
import type { CarriedInsertion, } from '../insertion-admission.ts';

//region Insertion coverage model

/**
 * One source-only slice proposed by preparation.
 */
export type InsertionCandidate = {
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
  /**
   * Whether syntax-bearing metadata requires insertion.
   */
  readonly frontMatter: boolean;
};

/**
 * Source-only slice beside latest coverage and deterministic evidence.
 */
export type InsertionCoverageRow = InsertionCandidate & {
  /**
   * Latest semantic coverage outcome.
   */
  readonly verdictKind: 'carried' | 'partly-carried' | 'absent' | 'split' | 'inconclusive';
  /**
   * Full coverage votes anchored to target.
   */
  readonly anchoredFull: number;
  /**
   * Partial coverage votes anchored to target.
   */
  readonly anchoredPartial: number;
  /**
   * Votes reporting passage absent.
   */
  readonly absentCount: number;
  /**
   * Voices heard in latest pass.
   */
  readonly heard: number;
  /**
   * Models asked in latest pass.
   */
  readonly asked: number;
  /**
   * Source destinations absent from target.
   */
  readonly missingDestinationCount: number;
  /**
   * Latest count-only coverage finding.
   */
  readonly coverageFinding: string;
  /**
   * Accumulated stage findings from coverage rounds.
   */
  readonly stageFindings: readonly string[];
  /**
   * Exact target regions supporting anchored coverage votes.
   */
  readonly coverageEvidence: readonly string[];
  /**
   * Parser downgrade findings from destination comparison.
   */
  readonly destinationFindings: readonly string[];
};

/**
 * Current resolution of all insertion coverage rows.
 */
export type InsertionCoverageClassification = {
  /**
   * Positions licensed for local insertion.
   */
  readonly positions: ReadonlySet<number>;
  /**
   * Passages proven fully rendered elsewhere.
   */
  readonly carried: readonly CarriedInsertion[];
  /**
   * Rows requiring another distinct placement task.
   */
  readonly unresolvedRows: readonly InsertionCoverageRow[];
  /**
   * Positions admitted by whole-page shortfall.
   */
  readonly shortfallAdmitted: ReadonlySet<number>;
  /**
   * Count-only findings for current state and prior rounds.
   */
  readonly findings: readonly string[];
};

/**
 * Classifies latest rows as inserted, carried, or unresolved.
 *
 * @param candidates - every source-only slice
 *
 * @param rows - latest semantic coverage evidence for prose candidates
 *
 * @param frontMatterPositions - metadata positions admitted deterministically
 *
 * @param sourceText - whole original for shortfall calculation
 *
 * @param targetText - whole target for shortfall calculation
 *
 * @returns Current insertion resolution and findings
 *
 * @example
 * ```ts
 * const state = classifyInsertionCoverage({
 *   candidates: [],
 *   rows: [],
 *   frontMatterPositions: new Set(),
 *   sourceText: '',
 *   targetText: '',
 * });
 * ```
 */
export function classifyInsertionCoverage(
  {
    candidates,
    rows,
    frontMatterPositions,
    sourceText,
    targetText,
  }: {
    readonly candidates: readonly InsertionCandidate[];
    readonly rows: readonly InsertionCoverageRow[];
    readonly frontMatterPositions: ReadonlySet<number>;
    readonly sourceText: string;
    readonly targetText: string;
  },
): InsertionCoverageClassification {
  /**
   * Rows latest roster found wholly absent.
   */
  const absent = rows.filter(function absentVerdict(row,): boolean {
    return row.verdictKind === 'absent';
  },);
  /**
   * Rows proven fully rendered elsewhere.
   */
  const carried = rows
    .filter(function carriedVerdict(row,): boolean {
      return row.verdictKind === 'carried';
    },)
    .map(function carriedInsertion(row,): CarriedInsertion {
      return {
        position: row.position,
        sliceIndex: row.sliceIndex,
        sourceText: row.sourceText,
        evidence: row.coverageEvidence,
      };
    },);
  /**
   * Absent passages requiring whole-page shortfall corroboration.
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
  const shortfallAdmitted = new Set(admitWithinShortfall({
    sourceText,
    targetText,
    passages: shortfallPassages,
  },)
    .map(Number,),);
  /**
   * Positions backed by semantic absence and independent signal.
   */
  const positions = new Set([
    ...frontMatterPositions,
    ...absent
      .filter(function corroborated(row,): boolean {
        return (row.missingDestinationCount > 0) || shortfallAdmitted.has(row.position,);
      },)
      .map(function toPosition(row,): number {
        return row.position;
      },),
  ],);
  /**
   * Positions proven carried elsewhere.
   */
  const carriedPositions = new Set(carried.map(function carriedPosition(candidate,): number {
    return candidate.position;
  },),);
  /**
   * Rows neither admitted nor proven fully carried elsewhere.
   */
  const unresolvedRows = rows.filter(function wasNotResolved(row,): boolean {
    return (!positions.has(row.position,)) && (!carriedPositions.has(row.position,));
  },);
  /**
   * Count-only findings for every candidate and coverage round.
   */
  const findings = [
    ...candidates
      .filter(function isFrontMatter(candidate,): boolean {
        return candidate.frontMatter;
      },)
      .map(function metadataFinding(candidate,): string {
        return `insertion-front-matter-admitted (slice ${String(candidate.sliceIndex,)})`;
      },),
    ...rows.flatMap(function evidence(row,): readonly string[] {
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
  ];
  return {
    positions,
    carried,
    unresolvedRows,
    shortfallAdmitted,
    findings,
  };
}

//endregion Insertion coverage model
