// PROTOTYPE ONLY: Candidate I total author-wave settlement.

import { hashContent, } from './document-node.ts';
import { assertCandidateBallotsAuthorized, } from './prototype-candidate-ballot-manifest.ts';
import type {
  CandidateBallotAuthorSettlement,
  CandidateBallotCandidate,
  CandidateBallotManifest,
} from './prototype-candidate-ballot-model.ts';
import type { CandidateBallotNodeRecord, } from './prototype-candidate-ballot-node-record.ts';

/**
 * Terminal Candidate I author node state.
 */
export type CandidateBallotAuthorState = {
  /**
   * Durable node record.
   */
  readonly record: CandidateBallotNodeRecord;
  /**
   * Runtime-owned candidate only after complete admission.
   */
  readonly candidate?: CandidateBallotCandidate;
};

/**
 * Canonical digest of settlement without self reference.
 *
 * @param settlement - Total rows before self digest attaches
 *
 * @returns Digest binding total author-wave state
 */
function settlementDigest(
  settlement: Omit<CandidateBallotAuthorSettlement, 'settlementDigest'>,
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
 * const settlement = createCandidateBallotAuthorSettlement({ states, manifest, });
 * ```
 */
export function createCandidateBallotAuthorSettlement({
  states,
  manifest,
}: {
  readonly states: readonly CandidateBallotAuthorState[];
  readonly manifest: CandidateBallotManifest;
}): CandidateBallotAuthorSettlement {
  if (states.length
    !== manifest.candidatePlan
    .length)
    throw new Error('candidate ballot author settlement is incomplete');
  /**
   * Terminal state lookup by manifested author ordinal.
   */
  const byOrdinal = new Map(states.map(function state(value,) {
    /**
     * Durable author-node id prefix.
     */
    const prefix = 'candidate-ballot-author-';
    if (!value.record
      .id
      .startsWith(prefix,))
      throw new Error('candidate ballot author settlement node id differs');
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
    throw new Error('candidate ballot author settlement ordinal repeats');
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
      throw new Error('candidate ballot author settlement plan row is absent');
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
      throw new Error('candidate ballot author settlement terminal state differs');
    if (candidate !== undefined)
      assertCandidateBallotsAuthorized({
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
 * const candidates = candidatesFromCandidateBallotSettlement({ settlement, manifest, });
 * ```
 */
export function candidatesFromCandidateBallotSettlement({
  settlement,
  manifest,
}: {
  readonly settlement: CandidateBallotAuthorSettlement;
  readonly manifest: CandidateBallotManifest;
}): readonly CandidateBallotCandidate[] {
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
    throw new Error('candidate ballot author settlement binding differs');
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
    assertCandidateBallotsAuthorized({
      candidates,
      manifest,
    });
  return candidates;
}
