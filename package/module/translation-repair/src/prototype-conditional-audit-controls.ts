// PROTOTYPE ONLY: Candidate E quote-bound audit and quorum controls.

import { carriesPicture, } from './chat-contract.ts';
import {
  confirmConditionalFindings,
  selectConditionalBaseline,
  selectConditionalBaselineByAuditorVotes,
  shouldAdoptConditionalResolution,
  shouldAdoptConditionalResolutionByAuditorVotes,
} from './prototype-conditional-audit.ts';
import type {
  ConditionalAuditResponse,
  ConditionalCandidate,
  ConfirmedConditionalFinding,
} from './prototype-conditional-audit-model.ts';
import {
  admitConditionalAudit,
  conditionalAuditGuard,
  conditionalAuditMessages,
  CONDITIONAL_AUDIT_NODES,
  conditionalAuditStructuralGuard,
} from './prototype-conditional-audit-plan.ts';
import { compileSlotDocument, } from './prototype-slot-compile.ts';
import type { SlotDocumentResponse, } from './prototype-slot-model.ts';
import { buildImmutableShell, } from './prototype-slot-shell.ts';

const SOURCE = `---\nname: Cat\n---\n# 猫\n\n猫休息。\n`;
const ARCHIVE = `---\nname: Cat\n---\n# Cat\n\nThe cat rests.\n`;

function englishResponse(
  {
    shell,
    label,
  }: {
    readonly shell: ReturnType<typeof buildImmutableShell>;
    readonly label: string;
  },
): SlotDocumentResponse {
  return {
    slots: Object.fromEntries(shell.slots.map(function slot(item,) {
      return [item.key, `${label} ${item.key}`,];
    },),),
  };
}

export function runConditionalAuditControls(): void {
  const shell = buildImmutableShell({ sourceText: SOURCE, archiveText: ARCHIVE, });
  const firstSlot = shell.slots[0];
  if (firstSlot === undefined)
    throw new Error('conditional audit fixture has no slot');
  const preferredResponse = englishResponse({ shell, label: 'Preferred', });
  const flawedResponse = englishResponse({ shell, label: 'Flawed', });
  const candidates: readonly ConditionalCandidate[] = [
    {
      id: 'preferred',
      priority: 1,
      response: preferredResponse,
      document: compileSlotDocument({ shell, response: preferredResponse, }),
    },
    {
      id: 'flawed',
      priority: 0,
      response: flawedResponse,
      document: compileSlotDocument({ shell, response: flawedResponse, }),
    },
  ];
  const finding = {
    slotKey: firstSlot.key,
    defectClass: 'wrong-meaning' as const,
    sourceAnchor: firstSlot.source,
    candidateAnchor: flawedResponse.slots[firstSlot.key] ?? '',
  };
  const audit: ConditionalAuditResponse = {
    candidates: {
      preferred: { findings: [], },
      flawed: { findings: [finding,], },
    },
  };
  const guard = conditionalAuditGuard({ shell, candidates, });
  const structuralGuard = conditionalAuditStructuralGuard({ shell, candidates, });
  if (!guard(audit,))
    throw new Error('conditional audit valid response control failed');
  const auditNode = CONDITIONAL_AUDIT_NODES[0];
  if (auditNode === undefined)
    throw new Error('conditional audit roster control failed');
  const messages = conditionalAuditMessages({
    node: auditNode,
    shell,
    sourceText: SOURCE,
    archiveText: ARCHIVE,
    candidates,
    media: [{ assetName: 'cat.webp', dataUri: 'data:image/webp;base64,AA==', digest: 'fixture', },],
  },);
  if (!carriesPicture({ messages, }))
    throw new Error('conditional audit vision control failed');
  const badAnchor: ConditionalAuditResponse = {
    candidates: {
      preferred: { findings: [], },
      flawed: { findings: [{ ...finding, candidateAnchor: 'absent', },], },
    },
  };
  if (guard(badAnchor,))
    throw new Error('conditional audit quote binding control failed');
  if (!structuralGuard(badAnchor,))
    throw new Error('conditional audit structural admission control failed');
  const badAnchorAdmission = admitConditionalAudit({ shell, candidates, response: badAnchor, });
  if ((badAnchorAdmission.response.candidates.flawed?.findings.length !== 0)
    || (badAnchorAdmission.rejectedFindings[0]?.reason !== 'candidate-anchor-unbound'))
    throw new Error('conditional audit unbound finding pruning control failed');
  const duplicate: ConditionalAuditResponse = {
    candidates: {
      preferred: { findings: [], },
      flawed: { findings: [finding, finding,], },
    },
  };
  if (guard(duplicate,))
    throw new Error('conditional audit duplicate finding control failed');
  if (!structuralGuard(duplicate,))
    throw new Error('conditional audit duplicate structural control failed');
  const duplicateAdmission = admitConditionalAudit({ shell, candidates, response: duplicate, });
  if ((duplicateAdmission.response.candidates.flawed?.findings.length !== 1)
    || (duplicateAdmission.rejectedFindings[0]?.reason !== 'duplicate-key'))
    throw new Error('conditional audit duplicate pruning control failed');
  const confirmed = confirmConditionalFindings({
    audits: [audit, audit,],
    candidateIds: candidates.map(function id(candidate,) { return candidate.id; },),
  },);
  if ((confirmed.length !== 1) || (selectConditionalBaseline({ candidates, findings: confirmed, }).id !== 'preferred'))
    throw new Error('conditional audit comparative selection control failed');
  const voted = selectConditionalBaselineByAuditorVotes({ candidates, audits: [audit, audit,], });
  if (!voted.evidenceFloorMet || (voted.candidate.id !== 'preferred') || (voted.votes.preferred !== 2))
    throw new Error('conditional audit selection vote control failed');
  const degradedVote = selectConditionalBaselineByAuditorVotes({ candidates, audits: [audit,], });
  if (degradedVote.evidenceFloorMet || (degradedVote.candidate.id !== 'flawed'))
    throw new Error('conditional audit selection evidence floor control failed');
  const emptyAudit: ConditionalAuditResponse = {
    candidates: {
      preferred: { findings: [], },
      flawed: { findings: [], },
    },
  };
  const abstained = selectConditionalBaselineByAuditorVotes({ candidates, audits: [emptyAudit, emptyAudit,], });
  if (abstained.evidenceFloorMet || (abstained.votes.preferred !== 0) || (abstained.votes.flawed !== 0))
    throw new Error('conditional audit empty ballot abstention control failed');
  const reduced = confirmConditionalFindings({
    audits: [audit,],
    candidateIds: candidates.map(function id(candidate,) { return candidate.id; },),
  },);
  if ((reduced.length !== 0) || (selectConditionalBaseline({ candidates, findings: reduced, }).id !== 'flawed'))
    throw new Error('conditional audit reduced quorum control failed');
  const baselineFindings: readonly ConfirmedConditionalFinding[] = [
    { candidateId: 'baseline', slotKey: firstSlot.key, defectClass: 'wrong-meaning', support: 2, },
    { candidateId: 'baseline', slotKey: firstSlot.key, defectClass: 'register', support: 2, },
  ];
  const resolutionFindings: readonly ConfirmedConditionalFinding[] = [
    { candidateId: 'resolution', slotKey: firstSlot.key, defectClass: 'register', support: 2, },
  ];
  const approvingAudit: ConditionalAuditResponse = {
    candidates: {
      baseline: { findings: [finding, { ...finding, defectClass: 'register', },], },
      resolution: { findings: [finding,], },
    },
  };
  if (!shouldAdoptConditionalResolutionByAuditorVotes({
    audits: [approvingAudit, approvingAudit,],
    baselineId: 'baseline',
    resolutionId: 'resolution',
  },))
    throw new Error('conditional audit post-adoption vote control failed');
  const regressingAudit: ConditionalAuditResponse = {
    candidates: {
      baseline: { findings: [finding,], },
      resolution: { findings: [{ ...finding, defectClass: 'tense', },], },
    },
  };
  if (shouldAdoptConditionalResolutionByAuditorVotes({
    audits: [approvingAudit, regressingAudit,],
    baselineId: 'baseline',
    resolutionId: 'resolution',
  },))
    throw new Error('conditional audit post-regression vote control failed');
  if (!shouldAdoptConditionalResolution({
    baselineFindings,
    resolutionFindings,
    usableAuditorCount: 2,
    resolverChangedOnlyLocatedSlots: true,
  },))
    throw new Error('conditional audit strict subset adoption control failed');
  const regressionFindings: readonly ConfirmedConditionalFinding[] = [
    ...resolutionFindings,
    { candidateId: 'resolution', slotKey: firstSlot.key, defectClass: 'tense', support: 2, },
  ];
  if (shouldAdoptConditionalResolution({
    baselineFindings,
    resolutionFindings: regressionFindings,
    usableAuditorCount: 2,
    resolverChangedOnlyLocatedSlots: true,
  },))
    throw new Error('conditional audit regression preservation control failed');
  if (shouldAdoptConditionalResolution({
    baselineFindings,
    resolutionFindings,
    usableAuditorCount: 1,
    resolverChangedOnlyLocatedSlots: true,
  },))
    throw new Error('conditional audit unavailable quorum preservation control failed');
  if (shouldAdoptConditionalResolution({
    baselineFindings,
    resolutionFindings,
    usableAuditorCount: 2,
    resolverChangedOnlyLocatedSlots: false,
  },))
    throw new Error('conditional audit unlocated resolver change control failed');
  if (shouldAdoptConditionalResolution({
    baselineFindings: [],
    resolutionFindings: [],
    usableAuditorCount: 2,
    resolverChangedOnlyLocatedSlots: true,
  },))
    throw new Error('conditional audit empty baseline control failed');
}
