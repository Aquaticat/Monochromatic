/**
 Independent HTTP fixtures exercise the maintained built sender.

 @module
 */
import {
  createAssessmentSender,
  type AssessmentTransportInput,
} from '@monochromatic-dev/pi-plugin-auto-mode';

//region Isolated callers preserve original encoded input and clock ownership

/**
 Fixture-only key makes accidental disclosure observable without reading real credentials.
 */
export const assessmentFixtureKey = 'fixture-gateway-secret';

/**
 Construct an original attempt without sharing mutable state between cases.

 @returns isolated original judgment attempt
 */
export function assessmentInput(): AssessmentTransportInput {
  return {
    body: '{"model":"typesafe/jev-1.13.0","state":"exact \\u003c bytes"}',
    signal: new AbortController().signal,
    deadlineAt: 5_000,
    attempt: 1,
  };
}

/**
 Bind the built sender to test-local HTTP and clock capabilities.

 @param fetchImpl - local HTTP boundary
 @param now - deterministic original monotonic clock
 @param readCredential - isolated credential reader

 @returns built sender with no provider route
 */
export function assessmentSender({
  fetchImpl,
  now = function initialClock(): number { return 0; },
  readCredential = function fixtureCredential(): string { return assessmentFixtureKey; },
}: {
  readonly fetchImpl: typeof fetch;
  readonly now?: () => number;
  readonly readCredential?: () => unknown;
}): ReturnType<typeof createAssessmentSender> {
  return createAssessmentSender({ fetchImpl, now, readCredential, },);
}

/**
 Capture an expected async failure without accepting a successful undefined return.

 @param run - isolated operation expected to fail

 @returns original caught value

 @throws Error when the expected rejection is absent
 */
export async function assessmentFailure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  }
  catch (error) {
    return error;
  }
  throw new Error('Expected assessment transport to reject',);
}

//endregion Isolated callers preserve original encoded input and clock ownership
