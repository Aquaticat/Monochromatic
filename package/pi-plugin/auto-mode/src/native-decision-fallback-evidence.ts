/**
 Decision evidence capture for the native decision fallback catalog.

 The capture installs one tagged-logger interception that keeps the actual
 diagnostic payloads for the catalog's strict evidence assertions. @module
 */
import { logger } from '@monochromatic-dev/module-logger/ts';
import {
  assertAssessmentEvidenceRecord,
  assertDecisionEvidenceRecord
} from './native-decision-fallback-evidence-types.ts';
import type {
  AssessmentEvidenceRecord,
  DecisionEvidenceRecord
} from './native-decision-fallback-evidence-types.ts';

/**
 Mutable view of the shared logger's debug slot.
 */
type DebugSlot = { debug: (message: string) => void };

/**
 Capture owner retaining parsed evidence records and logger restoration.
 */
export type DecisionFallbackEvidenceCapture = Readonly<{
  decisionRecords: DecisionEvidenceRecord[];
  assessmentRecords: AssessmentEvidenceRecord[];
  restore: () => void;
}>;

//region Parsed evidence records keep their original logged envelopes.

/**
 Parse one decision evidence payload into its asserted envelope.

 @param message - tagged logger message carrying the JSON record

 @returns captured decision evidence record

 @throws DecisionFallbackEvidenceShapeError when the envelope fields are absent
 */
function parseDecisionEvidence(message: string): DecisionEvidenceRecord {
  const parsed: unknown = JSON.parse(message.slice(message.indexOf('{')));
  assertDecisionEvidenceRecord(parsed);
  return parsed;
}

/**
 Parse one assessment evidence payload into its asserted envelope.

 @param message - tagged logger message carrying the JSON record

 @returns captured assessment evidence record

 @throws DecisionFallbackEvidenceShapeError when the envelope fields are absent
 */
function parseAssessmentEvidence(message: string): AssessmentEvidenceRecord {
  const parsed: unknown = JSON.parse(message.slice(message.indexOf('{')));
  assertAssessmentEvidenceRecord(parsed);
  return parsed;
}

//endregion

//region The capture keeps the actual tagged logger reachable and restorable.

/**
 Install decision evidence capture on the shared tagged logger.

 @returns capture records and the original debug restoration
 */
export function captureDecisionFallbackEvidence(): DecisionFallbackEvidenceCapture {
  const decisionRecords: DecisionEvidenceRecord[] = [];
  const assessmentRecords: AssessmentEvidenceRecord[] = [];
  const mutableLogger: DebugSlot = logger;
  const originalDebug = logger.debug;
  mutableLogger.debug = function captureDiagnostic(message: string): void {
    if (message.includes('[auto-mode-decision-evidence]'))
      decisionRecords.push(parseDecisionEvidence(message));
    if (message.includes('[auto-mode-assessment-evidence]'))
      assessmentRecords.push(parseAssessmentEvidence(message));
    originalDebug(message);
  };
  return {
    decisionRecords,
    assessmentRecords,
    restore: function restoreLoggerDebug(): void {
      mutableLogger.debug = originalDebug;
    }
  };
}

//endregion
