// PROTOTYPE ONLY: Candidate M total author settlement.

import { hashContent, } from './document-node.ts';
import { assertRiskAttestedCandidate, } from './prototype-risk-challenger-author.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import {
  CANDIDATE_M_MANIFEST_VERSION,
  type CandidateMAuthorState,
  type CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';
import type { ReviewUnitNodeRecord, } from './prototype-review-unit-node-record.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * One Candidate M terminal author settlement row.
 */
export type CandidateMAuthorSettlementRow = {
  readonly ordinal: number;
  readonly modelId: CandidateMCandidate['modelId'];
  readonly priority: number;
  readonly state: ReviewUnitNodeRecord['state'];
  readonly nodeRecordDigest: string;
  readonly candidate?: CandidateMCandidate;
};

/**
 * Complete Candidate M author-wave settlement.
 */
export type CandidateMAuthorSettlement = {
  readonly version: typeof CANDIDATE_M_MANIFEST_VERSION;
  readonly architecture: CandidateMManifest['architecture'];
  readonly manifestDigest: string;
  readonly rows: readonly CandidateMAuthorSettlementRow[];
  readonly settlementDigest: string;
};

/**
 * Digests settlement without self member.
 *
 * @param value - Total author-wave identity before self digest
 *
 * @returns Canonical author-wave identity
 */
function settlementDigest(
  value: Omit<CandidateMAuthorSettlement, 'settlementDigest'>,
): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/**
 * Creates exact Candidate M author settlement.
 *
 * @returns One terminal row per manifested author
 *
 * @example
 * ```ts
 * const settlement = createCandidateMAuthorSettlement({ states, manifest, shell, reviewPlan, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function createCandidateMAuthorSettlement({
  states,
  manifest,
  shell,
  reviewPlan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly states: readonly CandidateMAuthorState[];
  readonly manifest: CandidateMManifest;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateMAuthorSettlement {
  if (states.length
    !== manifest.candidatePlan
    .length)
    throw new Error('Candidate M author settlement is incomplete');
  /**
   * Static Candidate M author-node prefix.
   */
  const prefix = 'risk-challenger-author-';
  /**
   * Terminal state lookup by author ordinal.
   */
  const byOrdinal = new Map(states.map(function state(value,) {
    if (!value.record
      .id
      .startsWith(prefix,))
      throw new Error('Candidate M author node identity differs');
    return [
      Number(value.record
        .id
        .slice(prefix.length,)),
      value,
    ] as const;
  },),);
  if (byOrdinal.size !== states.length)
    throw new Error('Candidate M author ordinal repeats');
  /**
   * Terminal rows in exact manifest author order.
   */
  const rows = manifest.candidatePlan
    .map(function row(plan,) {
    /**
     * Terminal state for current author ordinal.
     */
    const state = byOrdinal.get(plan.ordinal,);
    if (state === undefined)
      throw new Error('Candidate M author settlement row is absent');
    /**
     * Durable node record for current author.
     */
    const {record} = state;
    /**
     * Optional complete candidate admitted from current author.
     */
    const {candidate} = state;
    if ((record.modelId !== plan.modelId)
      || (record.manifestDigest !== manifest.manifestDigest)
      || ((record.state === 'completed') !== (candidate !== undefined)))
      throw new Error('Candidate M author terminal state differs');
    if (candidate !== undefined)
      assertRiskAttestedCandidate({
        candidate,
        shell,
        manifest,
        reviewPlan,
        sourceText,
        archiveText,
        sourcePictures,
      },);
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
    version: CANDIDATE_M_MANIFEST_VERSION,
    architecture: manifest.architecture,
    manifestDigest: manifest.manifestDigest,
    rows,
  } as const;
  return {
    ...identity,
    settlementDigest: settlementDigest(identity,),
  };
}

/**
 * Derives admitted Candidate M candidates from bound settlement.
 *
 * @returns Completed candidates in manifest order
 *
 * @example
 * ```ts
 * const candidates = candidateMCandidates({ settlement, manifest, });
 * ```
 */
export function candidateMCandidates({
  settlement,
  manifest,
}: {
  readonly settlement: CandidateMAuthorSettlement;
  readonly manifest: CandidateMManifest;
}): readonly CandidateMCandidate[] {
  if ((settlement.version !== CANDIDATE_M_MANIFEST_VERSION)
    || (settlement.architecture !== manifest.architecture)
    || (settlement.manifestDigest !== manifest.manifestDigest)
    || (settlement.rows
      .length
      !== manifest.candidatePlan
      .length)
    || (settlement.settlementDigest !== settlementDigest({
      version: settlement.version,
      architecture: settlement.architecture,
      manifestDigest: settlement.manifestDigest,
      rows: settlement.rows,
    },)))
    throw new Error('Candidate M author settlement binding differs');
  return settlement.rows
    .flatMap(function candidate(row,) {
    return (row.state === 'completed') && (row.candidate !== undefined)
      ? [row.candidate,]
      : [];
  },);
}
