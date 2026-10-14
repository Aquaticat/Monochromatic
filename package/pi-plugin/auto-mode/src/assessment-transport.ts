/**
 Send the original encoded assessment through the incumbent direct HTTP route.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { assessmentHttpFailure, } from './assessment-http-failure.ts';

//region Transport owns HTTP resources while the judgment owns attempts and admission

/**
 Transport diagnostics exclude credentials, request content, and upstream response text.
 */
export class AssessmentTransportError extends Error {
  /**
   Identify the transport boundary without retaining borrowed failure causes.
   */
  override readonly name = 'AssessmentTransportError';
}

/**
 Original judgment supplies its already encoded body and preparation-inclusive deadline.
 */
export type AssessmentTransportInput = {
  readonly body: string;
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
  readonly attempt: number;
};

/**
 Fixed private-data route retained from the verified native transport.
 */
const endpoint = 'https://api.llmgateway.io/v1/systemone';
/**
 Inherited judgment and transport bounds remain fixed at bootstrap.
 */
const limits = {
  durationMs: 5_000,
  attempts: 3,
  requestBytes: 1_048_576,
  responseBytes: 65_536,
  successfulStatus: 200,
} as const;
/**
 Transport logs contain lifecycle information only.
 */
const l = tagged({ tag: 'auto-mode-assessment-transport', },);

/**
 Bind HTTP dependencies without reading credentials or dispatching a request at startup.
 Each call makes one HTTP attempt; the original judgment owns retries and the total budget.
 Raw response parsing and model attribution remain with the original wire consumer.

 @param fetchImpl - HTTP implementation bound by the native host
 
 @param now - original judgment's monotonic clock
 
 @param readCredential - lazy reader for the existing named Gateway credential

 @returns sender accepting an original judgment attempt

 @example
 ```ts
 const send = createAssessmentSender({
   fetchImpl: fetch,
   now: performance.now.bind(performance),
   readCredential: () => process.env.AUTO_MODE_LLMGATEWAY_API_KEY,
 });
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
   Factory scope carries through each dispatch diagnostic.
   */
  const rl = tagged({
    tag: createAssessmentSender.name,
    l,
  },);
  rl.debug('binding direct assessment transport',);

  /**
   Recheck the original clock and cancellation without creating a new deadline.

   @param input - original judgment cancellation and deadline

   @returns remaining duration for this HTTP attempt

   @throws AssessmentTransportError when cancellation or the original deadline prevents dispatch
   */
  function remaining(input: AssessmentTransportInput): number {
    tagged({
      tag: remaining.name,
      l: rl,
    },)
      .debug('checking original assessment lifetime',);
    if (input.signal
      .aborted)
      throw new AssessmentTransportError('Original assessment was cancelled',);
    /**
     Preparation time has already consumed part of the original five-second budget.
     */
    const left = input.deadlineAt - now();
    if ((!Number.isFinite(left,)) || (left < 1)
      || (left > limits.durationMs))
      throw new AssessmentTransportError('Original assessment deadline is expired or outside its five-second budget',);
    return left;
  }

  /**
   Consume response bytes under the inherited limit before returning any provider content.

   @param response - original HTTP response
   
   @param input - original judgment attempt

   @returns complete bounded response text

   @throws AssessmentTransportError when response bytes or lifetime exceed the transport contract
   */
  async function readResponse({
    response,
    input,
  }: {
    readonly response: Response;
    readonly input: AssessmentTransportInput;
  }): Promise<string> {
    tagged({
      tag: readResponse.name,
      l: rl,
    },)
      .debug('consuming bounded assessment response',);
    if (response.body === null)
      throw new AssessmentTransportError('Assessment HTTP response has no body',);
    /**
     Retained chunks never exceed the inherited 64-KiB response limit.
     */
    const received: {
      chunks: Uint8Array[];
      length: number
    } = {
      chunks: [],
      length: 0,
    };
    for await (const chunk of response.body) {
      remaining(input,);
      received.length += chunk.byteLength;
      if (received.length > limits.responseBytes)
        throw new AssessmentTransportError('Assessment HTTP response exceeds 65536 bytes',);
      received.chunks
        .push(chunk,);
    }
    remaining(input,);
    return new TextDecoder(
      'utf-8',
      { fatal: true, },
    ).decode(Buffer.concat(received.chunks,),);
  }

  /**
   Dispatch exactly once without changing the body, model, or original attempt accounting.

   @param input - original encoded body and owned attempt lifetime

   @returns raw response for the existing model and answer-set validator

   @throws AssessmentTransportError when preparation, HTTP, cancellation, or response handling fails
   */
  async function send(input: AssessmentTransportInput): Promise<string> {
    /**
     No borrowed request, response, credential, or upstream error enters logging.
     */
    const sl = tagged({
      tag: send.name,
      l: rl,
    },);
    sl.debug('preparing original assessment HTTP attempt',);
    try {
      remaining(input,);
      if ((!Number.isInteger(input.attempt,)) || (input.attempt < 1)
        || (input.attempt > limits.attempts))
        throw new AssessmentTransportError('Assessment HTTP attempt is outside the original three-attempt budget',);
      if (Buffer.byteLength(input.body,) > limits.requestBytes)
        throw new AssessmentTransportError('Assessment HTTP request exceeds 1048576 bytes',);
      /**
       Credentials are read only for a dispatch that already has an admissible consumer.
       */
      const key = readCredential();
      if (((typeof key) !== 'string') || (key.length === 0))
        throw new AssessmentTransportError('AUTO_MODE_LLMGATEWAY_API_KEY is unavailable for the assessment request',);
      if (input.body
        .includes(key,))
        throw new AssessmentTransportError('Assessment request contains its Gateway credential and was withheld',);
      /**
       Both native cancellation and the remaining original deadline govern fetch and body consumption.
       */
      const signal = AbortSignal.any([
        input.signal,
        AbortSignal.timeout(
          Math.floor(remaining(input,),),
        ),
      ],);
      sl.debug('dispatching original assessment HTTP attempt',);
      /**
       Redirect refusal retains the fixed private-data route.
       Gateway-internal retries are independent of this single client attempt.
       */
      const response = await fetchImpl(
        endpoint,
        {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          'x-no-fallback': 'true',
        },
        body: input.body,
        signal,
      },
      );
      /**
       The stream iterator cancels response consumption when its limit or deadline fails.
       */
      const raw = await readResponse({
        response,
        input,
      },);
      if (raw.includes(key,))
        throw new AssessmentTransportError('Assessment response echoed its Gateway credential and was withheld',);
      if (response.status !== limits.successfulStatus)
        throw new AssessmentTransportError(assessmentHttpFailure({
          raw,
          status: response.status,
        },),);
      signal.throwIfAborted();
      sl.debug('original assessment HTTP response completed',);
      return raw;
    }
    catch (error) {
      if (error instanceof AssessmentTransportError) {
        sl.debug(error.message,);
        throw error;
      }
      sl.debug('original assessment HTTP request or response failed',);
      throw new AssessmentTransportError('Assessment HTTP request or response failed; no provider answer was admitted',);
    }
  }
  return send;
}

//endregion Transport owns HTTP resources while the judgment owns attempts and admission
