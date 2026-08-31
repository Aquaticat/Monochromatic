// PROTOTYPE ONLY: Candidate K total author-wave settlement.

import { hashContent, } from './document-node.ts';
import { assertReviewUnitsAuthorized, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitAuthorSettlement,
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitNodeRecord, } from './prototype-review-unit-node-record.ts';

/**
 * Terminal Candidate K author node state.
 */
export type ReviewUnitAuthorState = {
  /**
   * Durable node record.
   */
  readonly record: ReviewUnitNodeRecord;
  /**
   * Runtime-owned candidate only after complete admission.
   */
  readonly candidate?: ReviewUnitCandidate;
};

/**
 * Canonical digest of settlement without self reference.
 *
 * @param settlement - Total rows before self digest attaches
 *
 * @returns Digest binding total author-wave state
 */
function settlementDigest(
  settlement: Omit<ReviewUnitAuthorSettlement, 'settlementDigest'>,
): string {
  return hashContent({ content: JSON.stringify(settlement,), });
}

/**
 * Creates one immutable terminal row for every author plan.
 *
 * @returns Complete runtime-owned author-wave settlement
 *
 * @example
 * ```ts
 * const settlement = createReviewUnitAuthorSettlement({ states, manifest, });
 * ```
 */
export function createReviewUnitAuthorSettlement({
  states,
  manifest,
}: {
  readonly states: readonly ReviewUnitAuthorState[];
  readonly manifest: ReviewUnitManifest;
}): ReviewUnitAuthorSettlement {
  if (states.length
    !== manifest.candidatePlan
    .length)
    throw new Error('review unit author settlement is incomplete');
  /**
   * Terminal state lookup by manifested author ordinal.
   */
  const byOrdinal = new Map(states.map(function state(value,) {
    /**
     * Durable author-node id prefix.
     */
    const prefix = 'review-unit-author-';
    if (!value.record
      .id
      .startsWith(prefix,))
      throw new Error('review unit author settlement node id differs');
    /**
     * Ordinal parsed from durable node id.
     */
    const ordinal = Number(value.record
      .id
      .slice(prefix.length,));
    return [
      ordinal,
      value,
    ] as const;
  },),);
  if (byOrdinal.size !== states.length)
    throw new Error('review unit author settlement ordinal repeats');
  /**
   * Settlement rows in canonical manifest plan order.
   */
  const rows = manifest.candidatePlan
    .map(function row(plan,) {
    /**
     * Terminal state required for current plan.
     */
    const state = byOrdinal.get(plan.ordinal,);
    if (state === undefined)
      throw new Error('review unit author settlement plan row is absent');
    /**
     * Durable node record and optional candidate.
     */
    const {
      record,
      candidate,
    } = state;
    if ((record.modelId !== plan.modelId)
      || (record.manifestDigest !== manifest.manifestDigest)
      || ((record.state === 'completed') !== (candidate !== undefined)))
      throw new Error('review unit author settlement terminal state differs');
    if (candidate !== undefined)
      assertReviewUnitsAuthorized({
        candidates: [candidate,],
        manifest,
      });
    return {
      ordinal: plan.ordinal,
      modelId: plan.modelId,
      priority: plan.priority,
      state: record.state,
      nodeRecordDigest: hashContent({ content: JSON.stringify(record,), }),
      ...(candidate === undefined ? {} : { candidate, }),
    };
  },);
  /**
   * Settlement identity before self digest.
   */
  const identity = {
    version: 1,
    manifestDigest: manifest.manifestDigest,
    rows,
  } as const;
  return {
    ...identity,
    settlementDigest: settlementDigest(identity,),
  };
}

/**
 * Derives admitted candidates only from complete immutable settlement.
 *
 * @returns Completed candidates in manifest plan order
 *
 * @example
 * ```ts
 * const candidates = candidatesFromReviewUnitSettlement({ settlement, manifest, });
 * ```
 */
export function candidatesFromReviewUnitSettlement({
  settlement,
  manifest,
}: {
  readonly settlement: ReviewUnitAuthorSettlement;
  readonly manifest: ReviewUnitManifest;
}): readonly ReviewUnitCandidate[] {
  if ((settlement.manifestDigest !== manifest.manifestDigest)
    || (settlement.rows
      .length
      !== manifest.candidatePlan
      .length)
    || (settlement.settlementDigest !== settlementDigest({
      version: settlement.version,
      manifestDigest: settlement.manifestDigest,
      rows: settlement.rows,
    },)))
    throw new Error('review unit author settlement binding differs');
  /**
   * Candidate subset derived from completed rows only.
   */
  const candidates = settlement.rows
    .flatMap(function candidate(row,) {
    return (row.state === 'completed') && (row.candidate !== undefined)
      ? [row.candidate,]
      : [];
  },);
  if (candidates.length > 0)
    assertReviewUnitsAuthorized({
      candidates,
      manifest,
    });
  return candidates;
}
