// PROTOTYPE ONLY: Candidate G verifier evidence location helpers.

import { hashContent, } from './document-node.ts';
import type {
  RealizationFinding,
  RealizationTargetAnchor,
  RealizedCandidate,
} from './prototype-realization-model.ts';

/** Resolves runtime candidate alias or refuses stale ballot row. */
export function realizationCandidateFor({ candidates, id, }: {
  readonly candidates: ReadonlyMap<string, RealizedCandidate>;
  readonly id: string;
}): RealizedCandidate {
  const candidate = candidates.get(id,);
  if (candidate === undefined)
    throw new Error(`realization verifier candidate ${id} is unknown`);
  return candidate;
}

/** Validates verifier-cited target range against exact candidate slot. */
export function assertRealizationFindingTargetAnchor({ anchor, candidate, allowedTargetSlotKeys, }: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: RealizedCandidate;
  readonly allowedTargetSlotKeys?: readonly string[];
}): void {
  const text = candidate.slots[anchor.slotKey];
  if (text === undefined)
    throw new Error(`realization verifier target slot ${anchor.slotKey} is unknown`);
  if ((allowedTargetSlotKeys !== undefined) && !allowedTargetSlotKeys.includes(anchor.slotKey,))
    throw new Error('realization verifier target slot differs from obligation ownership');
  const length = anchor.endOffset - anchor.startOffset;
  if (!Number.isInteger(anchor.startOffset,)
    || !Number.isInteger(anchor.endOffset,)
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length))
    throw new Error('realization verifier target anchor is outside half-open slot range');
  if (anchor.digest !== hashContent({ content: text.slice(anchor.startOffset, anchor.endOffset,), }))
    throw new Error('realization verifier target anchor digest differs');
}

/** Stable logical finding identity independent of alternate evidence quotes. */
export function realizationFindingKey({ finding, }: { readonly finding: RealizationFinding; }): string {
  const subject = finding.scope === 'obligation' ? finding.obligationId : finding.criterion;
  return `${finding.scope}\u0000${subject}\u0000${finding.defectClass}`;
}
