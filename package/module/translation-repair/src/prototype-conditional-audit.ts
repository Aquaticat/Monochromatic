// PROTOTYPE ONLY: Candidate E deterministic quorum, selection, and adoption.

import {
  type ConditionalAuditResponse,
  type ConditionalCandidate,
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
