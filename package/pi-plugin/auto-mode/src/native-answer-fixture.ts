/**
 Built answer readers are loaded without importing maintained runtime source. @module
 */
import assert from 'node:assert/strict';
import type { object, text, readAssessmentResponse, readRelationEstimate } from '../native/contract/lifecycle/claim-evidence-batch-selection/selection-values.ts';

/**
 Export contract shared by the native readers and their built consumer.
 */
type Readers = Readonly<{
  object: typeof object;
  text: typeof text;
  readAssessmentResponse: typeof readAssessmentResponse;
  readRelationEstimate: typeof readRelationEstimate;
}>;

/** Verify required callable exports before exercising built behavior.
 @param value - Built module namespace
 
 @returns Normally once required reader exports exist
 
 @throws AssertionError for absent built exports
 */
function assertReaders(value: unknown): asserts value is Readers {
  assert.ok(((typeof value) === 'object') && (value !== null));
  assert.ok(('object' in value) && ((typeof value.object) === 'function'));
  assert.ok(('text' in value) && ((typeof value.text) === 'function'));
  assert.ok(('readAssessmentResponse' in value) && ((typeof value.readAssessmentResponse) === 'function'));
  assert.ok(('readRelationEstimate' in value) && ((typeof value.readRelationEstimate) === 'function'));
}

/**
 Unknown until the built namespace satisfies the callable export contract.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/claim-evidence-batch-selection/selection-values.ts',
  import.meta.url
).href);
assertReaders(loaded);

/**
 Readers from the current native build artifact.
 */
export const readers: Readers = loaded;

/** Assert the public error category and diagnostic without swallowing unexpected failures.
 @param operation - Built reader call expected to reject

 @param message - Exact original diagnostic expected at this boundary
 
 @throws AssertionError for success or another diagnostic
 
 @example rejectAnswer({ operation() { throw new Error('fixture'); }, message: 'fixture' });
 */
export function rejectAnswer({
  operation,
  message
}: {
  readonly operation: () => unknown;
  readonly message: string;
}): void {
  assert.throws(
    operation,
    {
      name: 'QuestionSelectionError',
      message
    }
  );
}
