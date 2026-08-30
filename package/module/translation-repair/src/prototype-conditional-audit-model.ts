// PROTOTYPE ONLY: Candidate E quote-bound defect audit model.

import type { RosterModelId, } from './roster-id.ts';
import type { SlotDocumentResponse, } from './prototype-slot-model.ts';

export const CONDITIONAL_DEFECT_CLASSES = [
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'actor-reference',
  'chronology',
  'technical-legal-term',
  'grammar-usage',
  'tense',
  'register',
  'source-language-calque',
] as const;

export type ConditionalDefectClass = typeof CONDITIONAL_DEFECT_CLASSES[number];

export const SEVERE_CONDITIONAL_DEFECT_CLASSES: ReadonlySet<ConditionalDefectClass> = new Set([
  'wrong-meaning',
  'omission',
  'unsupported-addition',
  'identity-attribution',
  'actor-reference',
  'chronology',
  'technical-legal-term',
],);

export type ConditionalAuditFinding = {
  readonly slotKey: string;
  readonly defectClass: ConditionalDefectClass;
  readonly sourceAnchor: string;
  readonly candidateAnchor: string;
};

export type ConditionalAuditResponse = {
  readonly candidates: Readonly<Record<string, {
    readonly findings: readonly ConditionalAuditFinding[];
  }>>;
};

export type ConditionalRejectedFinding = {
  readonly candidateId: string;
  readonly slotKey: string;
  readonly defectClass: ConditionalDefectClass;
  readonly reason: 'source-anchor-unbound' | 'candidate-anchor-unbound' | 'duplicate-key';
};

export type ConditionalAuditAdmission = {
  readonly response: ConditionalAuditResponse;
  readonly rejectedFindings: readonly ConditionalRejectedFinding[];
};

export type ConditionalCandidate = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly response: SlotDocumentResponse;
  readonly document: string;
};

export type ConditionalResolutionBallot = {
  readonly approves: boolean;
  readonly baselineFindingKeys: readonly string[];
  readonly resolutionFindingKeys: readonly string[];
  readonly newResolutionFindingKeys: readonly string[];
};

export type ConditionalBaselineBallot = {
  readonly auditorModelId: RosterModelId;
  readonly selectedCandidateId: string | null;
};

export type ConditionalBaselineDecision = {
  readonly candidate: ConditionalCandidate;
  readonly votes: Readonly<Record<string, number>>;
  readonly ballots: readonly ConditionalBaselineBallot[];
  readonly evidenceFloorMet: boolean;
};

export type ConfirmedConditionalFinding = {
  readonly candidateId: string;
  readonly slotKey: string;
  readonly defectClass: ConditionalDefectClass;
  readonly support: number;
};
