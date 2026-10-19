/**
 Owner declaration for the built domain fixture assessment implementation.

 The declaration mirrors the emitted `domain-fixture-assessment.mjs` interface;
 the maintained sender type is the published assessment-sender contract. @module
 */
import type { createAssessmentSender } from '../maintained-policy.mjs';

/**
 Authored relation settings read by the fixture answer builder.
 */
export type DomainFixtureAssessmentSettings = Readonly<{
  relation?: string;
  unresolvedClause?: string;
  operationDecision?: 'approve' | 'deny' | 'unknown';
  operatingPolicy?: boolean;
  httpTransport?: boolean;
  transientHttpFailure?: boolean;
  lowConfidenceClause?: boolean;
  nextDecision?: boolean;
  nextInput?: string;
  nextResult?: string;
}>;

/**
 Mutable counters the fixture increments alongside catalog observations.
 */
export type DomainFixtureAssessmentObservations = {
  assessments: number;
  httpCalls: number;
  nextInputQuestions?: number;
};

/**
 Returned sender is the maintained HTTP transport or the authored wire answer.
 */
export type DomainFixtureAssessmentSender = ReturnType<typeof createAssessmentSender>
  | ((input: Readonly<{ body: string }>) => string);

/**
 Author relation answers over the maintained transport or the local wire.

 @param input - authored settings and shared observation counters

 @returns sender forwarding one decision request to its answer text
 */
export declare function createDomainFixtureAssessment(input: Readonly<{
  settings: DomainFixtureAssessmentSettings;
  observations: DomainFixtureAssessmentObservations;
}>): DomainFixtureAssessmentSender;
