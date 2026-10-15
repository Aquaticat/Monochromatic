/**
 Compose Luna wire conversion with the original bounded HTTP transport.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  createAssessmentHttpSender,
  type AssessmentTransportInput,
  AssessmentTransportError,
} from './assessment-transport.ts';
import { sendAssessmentPartitions } from './assessment-partitions.ts';

/**
 Conversion lifecycle logs exclude credentials and assessment content.
 */
const l = tagged({ tag: 'auto-mode-assessment-sender', },);

/**
 Original preparation-inclusive budget and byte limit also bound conversion.
 */
const conversionLimits = {
  durationMs: 15_000,
} as const;

//region Conversion consumes the original judgment deadline and one original attempt

/**
 Bind the selected Decisions contract without dispatching during startup.

 @param fetchImpl - original HTTP implementation

 @param now - original judgment's monotonic clock

 @param readCredential - lazy reader for the configured Gateway credential

 @returns complete native assessment sender

 @example
 ```ts
 const send = createAssessmentSender({ fetchImpl: fetch, now: performance.now.bind(performance), readCredential });
 ```
 */
export function createAssessmentSender({
  fetchImpl,
  now,
  readCredential,
}: {
  readonly fetchImpl: typeof fetch;
  readonly now: () => number;
  readonly readCredential: () => unknown;
}): (input: AssessmentTransportInput) => Promise<string> {
  /**
   The same dependencies govern conversion and HTTP dispatch.
   */
  const rl = tagged({
    tag: createAssessmentSender.name,
    l,
  },);
  rl.debug('binding original assessment to Luna Decisions',);
  /**
   HTTP retains its byte, credential, cancellation, and attempt guards.
   */
  const sendHttp = createAssessmentHttpSender({
    fetchImpl,
    now,
    readCredential,
  },);

  /**
   Conversion cannot restart or outlive the original assessment.

   @param input - original assessment lifetime

   @throws AssessmentTransportError for an invalid or exhausted lifetime
   */
  function assertLifetime(input: AssessmentTransportInput,): void {
    tagged({
      tag: assertLifetime.name,
      l: rl,
    },)
      .debug('checking original conversion lifetime',);
    /**
     The deadline includes native preparation and every conversion step.
     */
    const remaining = input.deadlineAt - now();
    if (input.signal
      .aborted
      || (!Number.isFinite(remaining,))
      || (remaining < 1)
      || (remaining > conversionLimits.durationMs))
      throw new AssessmentTransportError('Luna conversion exceeded the original assessment lifetime',);
  }

  /**
   Send once and restore the original decoder shape without adjusting any estimate.

   @param input - original encoded native assessment and attempt

   @returns attributed canonical response

   @throws AssessmentTransportError for transport or lifetime failures

   @throws DecisionWireError for unsupported request or response data
   */
  async function send(input: AssessmentTransportInput,): Promise<string> {
    tagged({
      tag: send.name,
      l: rl,
    },)
      .debug('converting original assessment for Luna',);
    assertLifetime(input,);
    /**
     The HTTP sender checks the converted request's bytes before reading credentials.
     */
    /**
     Attempt number, cancellation, and deadline pass through unchanged.
     */
    const decoded = await sendAssessmentPartitions({input,sendHttp,assertLifetime});
    /**
     Response identity and vocabulary checks do not supply policy admission.
     */
    assertLifetime(input,);
    return decoded;
  }
  return send;
}

//endregion Conversion preserves original judgment ownership
