// PROTOTYPE ONLY: Candidate G closed-world author-wave settlement.

import { hashContent, } from './document-node.ts';
import type { RealizationAuthorState, } from './prototype-realization-author-wave.ts';
import {
  assertRealizationCandidatesAuthorizedByManifest,
} from './prototype-realization-manifest.ts';
import type {
  RealizationManifest,
  RealizedCandidate,
} from './prototype-realization-model.ts';

/** Private nominal proof that orchestration created complete settlement. */
const REALIZATION_AUTHOR_SETTLEMENT: unique symbol = Symbol('realization author settlement',);

/** One manifest plan row after complete author dependency wave. */
export type RealizationAuthorSettlementRow = {
  readonly state: 'completed';
  readonly ordinal: number;
  readonly modelId: RealizationManifest['candidatePlan'][number]['modelId'];
  readonly promptDigest: string;
  readonly responseDigest: string;
  readonly providerResponseDigest: string;
  readonly candidate: RealizedCandidate;
} | {
  readonly state: 'spent-unusable';
  readonly ordinal: number;
  readonly modelId: RealizationManifest['candidatePlan'][number]['modelId'];
  readonly promptDigest: string;
  readonly failureType: string;
  readonly failureDigest: string;
};

/** Complete immutable author-wave evidence with one row per plan ordinal. */
export type RealizationAuthorSettlement = {
  readonly manifestDigest: string;
  readonly rows: readonly RealizationAuthorSettlementRow[];
  readonly settlementDigest: string;
  readonly [REALIZATION_AUTHOR_SETTLEMENT]: true;
};

/** Canonical digest excluding self-referential settlement digest. */
function settlementDigest({ manifestDigest, rows, }: {
  readonly manifestDigest: string;
  readonly rows: readonly RealizationAuthorSettlementRow[];
}): string {
  return hashContent({ content: JSON.stringify({ manifestDigest, rows, },), });
}

/** Builds complete settlement only from terminal fixed author node states. */
export function createRealizationAuthorSettlement({ states, manifest, }: {
  readonly states: readonly RealizationAuthorState[];
  readonly manifest: RealizationManifest;
}): RealizationAuthorSettlement {
  if (states.length !== manifest.candidatePlan.length)
    throw new Error('realization author settlement row count differs from manifest');
  const rows = manifest.candidatePlan.map(function settle(plan, ordinal,) {
    const state = states[ordinal];
    if ((state === undefined)
      || (state.record.id !== `realization-author-${String(plan.ordinal,)}`)
      || (state.record.modelId !== plan.modelId)
      || (state.record.manifestDigest !== manifest.manifestDigest))
      throw new Error('realization author settlement node binding differs');
    if (state.candidate === undefined) {
      if ((state.record.state !== 'spent-unusable')
        || (state.record.failureDigest === undefined))
        throw new Error('realization author settlement pending row is not terminal');
      return {
        state: 'spent-unusable' as const,
        ordinal: plan.ordinal,
        modelId: plan.modelId,
        promptDigest: state.record.promptDigest,
        failureType: state.record.failureType ?? 'UnusableAuthorResponse',
        failureDigest: state.record.failureDigest,
      };
    }
    if ((state.record.state !== 'completed')
      || (state.record.responseDigest === undefined)
      || (state.record.providerResponseDigest === undefined)
      || (state.record.replyCacheKey !== state.record.basePromptDigest)
      || (state.candidate.modelId !== state.record.modelId)
      || (state.candidate.manifestDigest !== state.record.manifestDigest))
      throw new Error('realization author settlement candidate row is not completed');
    return {
      state: 'completed' as const,
      ordinal: plan.ordinal,
      modelId: plan.modelId,
      promptDigest: state.record.promptDigest,
      responseDigest: state.record.responseDigest,
      providerResponseDigest: state.record.providerResponseDigest,
      candidate: state.candidate,
    };
  },);
  const candidates = rows.flatMap(function candidate(row,): readonly RealizedCandidate[] {
    return row.state === 'completed' ? [row.candidate,] : [];
  },);
  if (candidates.length > 0)
    assertRealizationCandidatesAuthorizedByManifest({ candidates, manifest, });
  return {
    manifestDigest: manifest.manifestDigest,
    rows,
    settlementDigest: settlementDigest({ manifestDigest: manifest.manifestDigest, rows, }),
    [REALIZATION_AUTHOR_SETTLEMENT]: true,
  };
}

/** Revalidates total settlement and returns exactly its completed candidates. */
export function candidatesFromRealizationAuthorSettlement({ settlement, manifest, }: {
  readonly settlement: RealizationAuthorSettlement;
  readonly manifest: RealizationManifest;
}): readonly RealizedCandidate[] {
  if ((settlement[REALIZATION_AUTHOR_SETTLEMENT] !== true)
    || (settlement.manifestDigest !== manifest.manifestDigest)
    || (settlement.rows.length !== manifest.candidatePlan.length)
    || (settlement.settlementDigest !== settlementDigest({
      manifestDigest: settlement.manifestDigest,
      rows: settlement.rows,
    },)))
    throw new Error('realization author settlement identity differs');
  for (const plan of manifest.candidatePlan) {
    const row = settlement.rows[plan.ordinal];
    if ((row === undefined)
      || (row.ordinal !== plan.ordinal)
      || (row.modelId !== plan.modelId)
      || ((row.state === 'completed') && (row.candidate.candidateOrdinal !== plan.ordinal)))
      throw new Error('realization author settlement plan binding differs');
  }
  const candidates = settlement.rows.flatMap(function candidate(row,): readonly RealizedCandidate[] {
    return row.state === 'completed' ? [row.candidate,] : [];
  },);
  if (candidates.length > 0)
    assertRealizationCandidatesAuthorizedByManifest({ candidates, manifest, });
  return candidates;
}
