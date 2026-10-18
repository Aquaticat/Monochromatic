/** Correlation for authenticated original assessment envelopes. @module */
import type { QuestionRequest } from '../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';

/** Hash the original parent and prepared operation snapshots for local log correlation. */
export declare function operationDiagnosticId(envelope: unknown): string;

/** Retain complete selected model inputs and matching response diagnostics. */
export declare function captureAssessmentDiagnostics(input: Readonly<{
  request: QuestionRequest & Readonly<{ model: string }>;
  state: unknown;
  questions: unknown;
}>): (response: Readonly<{ parsed?: unknown; error?: unknown; raw?: unknown }>) => void;
