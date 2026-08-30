// PROTOTYPE ONLY: Candidate E deterministic quorum, selection, and adoption.

import {
  type ConditionalAuditResponse,
  type ConditionalBaselineDecision,
  type ConditionalCandidate,
  type ConditionalResolutionBallot,
  type ConfirmedConditionalFinding,
  SEVERE_CONDITIONAL_DEFECT_CLASSES,
} from './prototype-conditional-audit-model.ts';

// Components are fixed candidate ids, slot keys, and enum classes, so NUL cannot collide.
function findingKey(
  {
    candidateId,
    slotKey,
    defectClass,
  }: {
    readonly candidateId: string;
    readonly slotKey: string;
    readonly defectClass: string;
  },
): string {
  return `${candidateId}\u0000${slotKey}\u0000${defectClass}`;
}

export function confirmConditionalFindings(
  {
    audits,
    candidateIds,
  }: {
    readonly audits: readonly ConditionalAuditResponse[];
    readonly candidateIds: readonly string[];
  },
): readonly ConfirmedConditionalFinding[] {
  if (audits.length < 2)
    return [];
  const candidateSet = new Set(candidateIds,);
  // Agreement is intentionally candidate + slot + class, not exact anchor text.
  // Anchors prove each claim is located; auditors may quote different spans of same defect.
  const counts = audits.reduce(function collect(accumulator, audit,) {
    for (const [candidateId, candidate,] of Object.entries(audit.candidates,)) {
      if (!candidateSet.has(candidateId,))
        continue;
      for (const finding of candidate.findings) {
        const key = findingKey({
          candidateId,
          slotKey: finding.slotKey,
          defectClass: finding.defectClass,
        },);
        accumulator.set(key, (accumulator.get(key,) ?? 0) + 1,);
      }
    }
    return accumulator;
  }, new Map<string, number>(),);
  const threshold = 2;
  return [...counts.entries(),]
    .filter(function confirmed(entry,) { return entry[1] >= threshold; },)
    .map(function finding(entry,): ConfirmedConditionalFinding {
      const [candidateId = '', slotKey = '', defectClass = '',] = entry[0].split('\u0000',);
      return {
        candidateId,
        slotKey,
        defectClass: defectClass as ConfirmedConditionalFinding['defectClass'],
        support: entry[1],
      };
    },)
    .toSorted(function stable(left, right,) {
      return left.candidateId.localeCompare(right.candidateId,)
        || left.slotKey.localeCompare(right.slotKey,)
        || left.defectClass.localeCompare(right.defectClass,);
    },);
}

function candidateTuple(
  {
    candidateId,
    findings,
  }: {
    readonly candidateId: string;
    readonly findings: readonly ConfirmedConditionalFinding[];
  },
): readonly [number, number] {
  const own = findings.filter(function candidate(finding,) { return finding.candidateId === candidateId; },);
  const severe = own.filter(function severeFinding(finding,) {
    return SEVERE_CONDITIONAL_DEFECT_CLASSES.has(finding.defectClass,);
  },).length;
  return [severe, own.length,];
}

export function selectConditionalBaseline(
  {
    candidates,
    findings,
  }: {
    readonly candidates: readonly ConditionalCandidate[];
    readonly findings: readonly ConfirmedConditionalFinding[];
  },
): ConditionalCandidate {
  const selected = candidates.toSorted(function best(left, right,) {
    const leftTuple = candidateTuple({ candidateId: left.id, findings, });
    const rightTuple = candidateTuple({ candidateId: right.id, findings, });
    return (leftTuple[0] - rightTuple[0])
      || (leftTuple[1] - rightTuple[1])
      || (left.priority - right.priority);
  },)[0];
  if (selected === undefined)
    throw new Error('conditional shell candidate set is empty');
  return selected;
}

export function selectConditionalBaselineByAuditorVotes(
  {
    candidates,
    audits,
  }: {
    readonly candidates: readonly ConditionalCandidate[];
    readonly audits: readonly ConditionalAuditResponse[];
  },
): ConditionalBaselineDecision {
  const selections = audits.flatMap(function ballot(audit,): readonly string[] {
    const findings: readonly ConfirmedConditionalFinding[] = candidates.flatMap(function candidateFindings(candidate,) {
      return (audit.candidates[candidate.id]?.findings ?? []).map(function finding(item,) {
        return {
          candidateId: candidate.id,
          slotKey: item.slotKey,
          defectClass: item.defectClass,
          support: 1,
        };
      },);
    },);
    return findings.length === 0 ? [] : [selectConditionalBaseline({ candidates, findings, }).id,];
  },);
  const votes = Object.fromEntries(candidates.map(function candidateVotes(candidate,) {
    return [candidate.id, selections.filter(function selected(id,) { return id === candidate.id; },).length,];
  },),);
  const requiredVotes = 2;
  const winner = candidates.toSorted(function mostVotes(left, right,) {
    return ((votes[right.id] ?? 0) - (votes[left.id] ?? 0)) || (left.priority - right.priority);
  },)[0];
  const fallback = candidates.toSorted(function priority(left, right,) { return left.priority - right.priority; },)[0];
  if ((winner === undefined) || (fallback === undefined))
    throw new Error('conditional shell candidate set is empty');
  const evidenceFloorMet = (votes[winner.id] ?? 0) >= requiredVotes;
  return {
    candidate: evidenceFloorMet ? winner : fallback,
    votes,
    evidenceFloorMet,
  };
}

function auditFindingKeys(
  {
    audit,
    candidateId,
  }: {
    readonly audit: ConditionalAuditResponse;
    readonly candidateId: string;
  },
): ReadonlySet<string> {
  return new Set((audit.candidates[candidateId]?.findings ?? []).map(function key(finding,) {
    return findingKey({ candidateId: '', slotKey: finding.slotKey, defectClass: finding.defectClass, });
  },),);
}

export function conditionalResolutionBallot(
  {
    audit,
    baselineId,
    resolutionId,
  }: {
    readonly audit: ConditionalAuditResponse;
    readonly baselineId: string;
    readonly resolutionId: string;
  },
): ConditionalResolutionBallot {
  const baselineKeys = auditFindingKeys({ audit, candidateId: baselineId, });
  const resolutionKeys = auditFindingKeys({ audit, candidateId: resolutionId, });
  const newResolutionFindingKeys = [...resolutionKeys,]
    .filter(function introduced(key,) { return !baselineKeys.has(key,); })
    .toSorted();
  return {
    approves: (baselineKeys.size > 0)
      && (resolutionKeys.size < baselineKeys.size)
      && (newResolutionFindingKeys.length === 0),
    baselineFindingKeys: [...baselineKeys,].toSorted(),
    resolutionFindingKeys: [...resolutionKeys,].toSorted(),
    newResolutionFindingKeys,
  };
}

export function shouldAdoptConditionalResolutionByAuditorVotes(
  {
    audits,
    baselineId,
    resolutionId,
  }: {
    readonly audits: readonly ConditionalAuditResponse[];
    readonly baselineId: string;
    readonly resolutionId: string;
  },
): boolean {
  const approvals = audits.filter(function approves(audit,) {
    return conditionalResolutionBallot({ audit, baselineId, resolutionId, }).approves;
  },).length;
  return approvals >= 2;
}

export function shouldAdoptConditionalResolution(
  {
    baselineFindings,
    resolutionFindings,
    usableAuditorCount,
    resolverChangedOnlyLocatedSlots,
  }: {
    readonly baselineFindings: readonly ConfirmedConditionalFinding[];
    readonly resolutionFindings: readonly ConfirmedConditionalFinding[];
    readonly usableAuditorCount: number;
    readonly resolverChangedOnlyLocatedSlots: boolean;
  },
): boolean {
  if ((usableAuditorCount < 2) || !resolverChangedOnlyLocatedSlots || (baselineFindings.length === 0))
    return false;
  const baselineKeys = new Set(baselineFindings.map(function key(finding,) {
    return findingKey({ candidateId: '', slotKey: finding.slotKey, defectClass: finding.defectClass, });
  },),);
  const resolutionKeys = new Set(resolutionFindings.map(function key(finding,) {
    return findingKey({ candidateId: '', slotKey: finding.slotKey, defectClass: finding.defectClass, });
  },),);
  return (resolutionKeys.size < baselineKeys.size)
    && [...resolutionKeys,].every(function existed(key,) { return baselineKeys.has(key,); });
}
