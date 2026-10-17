/** Actual HTTP failures retain bounded retry eligibility without borrowed private data. @module */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { isRetryableAssessmentFailure } from '@monochromatic-dev/pi-plugin-auto-mode';
import { assessmentFailure, assessmentFixtureKey, assessmentInput, assessmentSender } from './assessment-transport-fixture.ts';

//region Only failed HTTP invocations supply the owned retry category.
await describe({ name: 'assessment failure classification', children: [
  ...['request', 'credential', 'cancelled', 'response', 'status'].map(function failureStage(stage) {
    return it({ name: `classifies ${stage} failure without retaining private text`, fn: async function classifyActualFailure() {
      /** Cancellation remains owned by this isolated original caller. */
      const controller = new AbortController();
      /** Physical invocation counts distinguish credential rejection from HTTP failure. */
      const calls = { count: 0 };
      /** Borrowed failure text must never survive in the returned error or cause. */
      const privateFailure = new TypeError(assessmentFixtureKey);
      /** The built sender performs its real credential, dispatch, and response stages. */
      const send = assessmentSender({
        readCredential: function readFixtureCredential() {
          if (stage === 'credential') throw privateFailure;
          return assessmentFixtureKey;
        },
        fetchImpl: async function rejectFixtureRequest() {
          calls.count++;
          if (stage === 'cancelled') controller.abort(privateFailure);
          if (stage === 'status') return new Response('private upstream body', { status: 503 });
          if (stage === 'response') return new Response(new ReadableStream({
            start(stream) { stream.error(privateFailure); },
          }));
          throw privateFailure;
        },
      });
      /** Capture the actual sanitized category rather than manufacturing a retryable instance. */
      const failure = await assessmentFailure(async function dispatchOriginalAttempt() {
        return await send({ ...assessmentInput(), signal: controller.signal });
      });
      expect(isRetryableAssessmentFailure(failure)).toBe(stage === 'request');
      expect(calls.count).toBe(stage === 'credential' ? 0 : 1);
      expect(String(failure)).not.toContain(assessmentFixtureKey);
      expect(String(failure)).not.toContain('private upstream body');
      expect(failure).not.toHaveProperty('cause');
    } });
  }),
  it({ name: 'requires complete invocation failures and rejects empty, cyclic, mixed, and unknown bundles', fn: async function classifyCompleteBundles() {
    /** The retry category can only come from the built HTTP sender. */
    const send = assessmentSender({ fetchImpl: async function failHttpInvocation() { throw new TypeError('fixture connection failed'); } });
    /** This retained category contains no borrowed upstream cause. */
    const failure = await assessmentFailure(async function dispatchOriginalAttempt() { return await send(assessmentInput()); });
    expect(isRetryableAssessmentFailure(new AggregateError([failure], 'single failed call'))).toBe(true);
    expect(isRetryableAssessmentFailure(new AggregateError([failure, failure], 'shared failure reason'))).toBe(true);
    expect(isRetryableAssessmentFailure(new AggregateError([new AggregateError([failure], 'inner')], 'outer'))).toBe(true);
    expect(isRetryableAssessmentFailure(new AggregateError([], 'empty'))).toBe(false);
    expect(isRetryableAssessmentFailure(new AggregateError([failure, new Error('unqualified')], 'mixed'))).toBe(false);
    expect(isRetryableAssessmentFailure({ name: 'AssessmentRequestFailure' })).toBe(false);
    /** An aggregate cycle is not a finite transport-failure explanation. */
    const cyclic = new AggregateError([], 'cyclic');
    cyclic.errors.push(cyclic);
    expect(isRetryableAssessmentFailure(cyclic)).toBe(false);
  } }),
] });
//endregion
