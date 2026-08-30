// PROTOTYPE ONLY: Candidate E quote-bound defect audit model.

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

export type ConditionalCandidate = {
  readonly id: string;
  readonly priority: number;
  readonly response: SlotDocumentResponse;
  readonly document: string;
};

export type ConfirmedConditionalFinding = {
  readonly candidateId: string;
  readonly slotKey: string;
  readonly defectClass: ConditionalDefectClass;
  readonly support: number;
};
