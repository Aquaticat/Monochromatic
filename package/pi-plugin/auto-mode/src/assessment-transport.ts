/**
 Send the original encoded assessment through the incumbent direct HTTP route.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { assessmentHttpFailure, } from './assessment-http-failure.ts';
import { AssessmentTransportError, AssessmentRequestFailure } from './assessment-failure.ts';
export { AssessmentTransportError } from './assessment-failure.ts';

//region Transport owns HTTP resources while the judgment owns attempts and admission

/**
 Original judgment supplies its already encoded body and preparation-inclusive performance target.
 */
export type AssessmentTransportInput = {
  /**
   Owned judgment capability accounts for every parallel provider invocation.
   */
  readonly runBundle?: <Result>(operations: readonly ((input: {
    readonly signal: AbortSignal;
    readonly targetAt: number;
    readonly attempt: number;
  }) => Promise<Result>)[]) => Promise<readonly Result[]>;
  readonly body: string;
  readonly signal: AbortSignal;
  readonly targetAt: number;
  readonly attempt: number;
};

/**
 Fixed private-data route retained from the verified native transport.
 */
const endpoint = 'https://api.llmgateway.io/v1/decisions';
/**
 Inherited judgment and transport bounds remain fixed at bootstrap.
 */
const limits = {
  attempts: 9,
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
 const send = createAssessmentHttpSender({
   fetchImpl: fetch,
   now: performance.now.bind(performance),
   readCredential: () => process.env.AUTO_MODE_LLMGATEWAY_API_KEY,
 });
 ```
 */
export function createAssessmentHttpSender({
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
    tag: createAssessmentHttpSender.name,
    l,
  },);
  rl.debug('binding direct assessment transport',);

  /**
   Recheck the original clock and cancellation without creating a new performance target.

   @param input - original judgment cancellation and performance target

   @throws AssessmentTransportError when cancellation or an invalid clock prevents dispatch
   */
  function checkLifetime(input: AssessmentTransportInput): void {
    tagged({
      tag: checkLifetime.name,
      l: rl,
    },)
      .debug('checking original assessment lifetime',);
    if (input.signal
      .aborted)
      throw new AssessmentTransportError('Original assessment was cancelled',);
    /**
     Preparation time is measured against an advisory target and never expires evidence.
     */
    if (!Number.isFinite(now(),))
      throw new AssessmentTransportError('Original assessment clock is invalid',);
  }

  /**
   Consume complete response bytes while retaining original cancellation.

   @param response - original HTTP response
   
   @param input - original judgment attempt

   @returns complete response text

   @throws AssessmentTransportError when response decoding or cancellation fails
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
      .debug('consuming complete assessment response',);
    if (response.body === null)
      throw new AssessmentTransportError('Assessment HTTP response has no body',);
    /**
     Retain every received chunk without truncation.
     */
    const received: {
      chunks: Uint8Array[];
      length: number
    } = {
      chunks: [],
      length: 0,
    };
    for await (const chunk of response.body) {
      checkLifetime(input,);
      received.length += chunk.byteLength;
      received.chunks
        .push(chunk,);
    }
    checkLifetime(input,);
    return new TextDecoder(
      'utf-8',
      { fatal: true, },
    ).decode(Buffer.concat(received.chunks,),);
  }

  /**
   Preserve a fixed category for an actual fetch failure while withholding its borrowed cause.
   @param url - fixed assessment endpoint
   @param options - original request and cancellation
   @returns original complete HTTP response
   @throws AssessmentRequestFailure for a fetch TypeError while the caller remains active
   @throws original error for cancellation or a nontransport failure
   */
  async function dispatchRequest({ url, options }: { readonly url: string; readonly options: RequestInit }): Promise<Response> {
    const dl = tagged({ tag: dispatchRequest.name, l: rl });
    try {
      return await fetchImpl(url, options);
    }
    catch (error) {
      dl.debug('assessment HTTP invocation failed');
      if (!options.signal?.aborted && error instanceof TypeError)
        throw new AssessmentRequestFailure('Assessment HTTP invocation failed with TypeError; no provider answer was admitted');
      throw error;
    }
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
      checkLifetime(input,);
      if ((!Number.isInteger(input.attempt,)) || (input.attempt < 1)
        || (input.attempt > limits.attempts))
        throw new AssessmentTransportError('Assessment HTTP attempt is outside the original nine-call bundle budget',);
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
       Native cancellation governs fetch and body consumption without an advisory-target timer.
       */
      const {signal} = input;
      sl.debug('dispatching original assessment HTTP attempt',);
      /**
       Redirect refusal retains the fixed private-data route.
       Gateway-internal retries are independent of this single client attempt.
       */
      const response = await dispatchRequest({
        url: endpoint,
        options: {
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
      });
      /**
       The stream iterator cancels response consumption when original cancellation is observed.
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
