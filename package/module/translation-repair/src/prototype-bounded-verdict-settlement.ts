// PROTOTYPE ONLY: Candidate H total author-wave settlement.

import { hashContent, } from './document-node.ts';
import { assertBoundedCandidatesAuthorized, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedAuthorSettlement,
  BoundedCandidate,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import type { SlotNodeRecord, } from './prototype-slot-runtime.ts';

/** Terminal Candidate H author node state. */
export type BoundedAuthorState = {
  readonly record: SlotNodeRecord;
  readonly candidate?: BoundedCandidate;
};

/** Canonical digest of settlement without self reference. */
function settlementDigest(
  settlement: Omit<BoundedAuthorSettlement, 'settlementDigest'>,
): string {
  return hashContent({ content: JSON.stringify(settlement,), });
}

/** Creates one immutable terminal row for every author plan. */
export function createBoundedAuthorSettlement({
  states,
  manifest,
}: {
  readonly states: readonly BoundedAuthorState[];
  readonly manifest: BoundedVerdictManifest;
}): BoundedAuthorSettlement {
  if (states.length !== manifest.candidatePlan.length)
    throw new Error('bounded verdict author settlement is incomplete');
  const byOrdinal = new Map(states.map(function state(value,) {
    const prefix = 'bounded-author-';
    if (!value.record.id.startsWith(prefix,))
      throw new Error('bounded verdict author settlement node id differs');
    const ordinal = Number(value.record.id.slice(prefix.length,),);
    return [ordinal, value,] as const;
  },),);
  if (byOrdinal.size !== states.length)
    throw new Error('bounded verdict author settlement ordinal repeats');
  const rows = manifest.candidatePlan.map(function row(plan,) {
    const state = byOrdinal.get(plan.ordinal,);
    if (state === undefined)
      throw new Error('bounded verdict author settlement plan row is absent');
    const { record, candidate, } = state;
    if ((record.modelId !== plan.modelId)
      || (record.manifestDigest !== manifest.manifestDigest)
      || ((record.state === 'completed') !== (candidate !== undefined)))
      throw new Error('bounded verdict author settlement terminal state differs');
    if (candidate !== undefined)
      assertBoundedCandidatesAuthorized({ candidates: [candidate,], manifest, });
    return {
      ordinal: plan.ordinal,
      modelId: plan.modelId,
      priority: plan.priority,
      state: record.state,
      nodeRecordDigest: hashContent({ content: JSON.stringify(record,), }),
      ...(candidate === undefined ? {} : { candidate, }),
    };
  },);
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

/** Derives admitted candidates only from complete immutable settlement. */
export function candidatesFromBoundedSettlement({
  settlement,
  manifest,
}: {
  readonly settlement: BoundedAuthorSettlement;
  readonly manifest: BoundedVerdictManifest;
}): readonly BoundedCandidate[] {
  if ((settlement.manifestDigest !== manifest.manifestDigest)
    || (settlement.rows.length !== manifest.candidatePlan.length)
    || (settlement.settlementDigest !== settlementDigest({
      version: settlement.version,
      manifestDigest: settlement.manifestDigest,
      rows: settlement.rows,
    },)))
    throw new Error('bounded verdict author settlement binding differs');
  const candidates = settlement.rows.flatMap(function candidate(row,) {
    return row.state === 'completed' && row.candidate !== undefined
      ? [row.candidate,]
      : [];
  },);
  if (candidates.length > 0)
    assertBoundedCandidatesAuthorized({ candidates, manifest, });
  return candidates;
}
