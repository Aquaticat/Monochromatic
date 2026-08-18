import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { SyntheticHttpError, } from './completion-shape.ts';
import { StreamDegenerateError, } from './stream-runaway-watch.ts';
import type { ModelTransport, } from './synthetic-transport.ts';

//region Transient retry
// Transport-level retry over the injected HTTP seam. Two transient failure
// shapes back off and try again on an equal-jitter ladder: retryable
// statuses (timeouts, throttles, upstream and gateway hiccups) and thrown
// transport failures (connection resets mid-stream). Caller aborts always
// propagate untouched: user steering is never weather.

/**
 * Request Timeout: the server gave up waiting for the request.
 */
const HTTP_REQUEST_TIMEOUT = 408;

/**
 * Too Many Requests: the provider throttled the call.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Internal Server Error: from an inference stack this is routinely a
 * transient upstream failure, not a request defect.
 */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * Bad Gateway: observed live when a 42-stream burst hit the provider.
 */
const HTTP_BAD_GATEWAY = 502;

/**
 * Service Unavailable.
 */
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Gateway Timeout.
 */
const HTTP_GATEWAY_TIMEOUT = 504;

/**
 * Statuses worth one more try:
 * timeouts, throttles, upstream and gateway hiccups.
 * A live 42-stream burst drew instant 502s on most calls while identical
 * calls succeeded moments later, so these are transient by observation.
 */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  HTTP_REQUEST_TIMEOUT,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_BAD_GATEWAY,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_GATEWAY_TIMEOUT,
],);

/**
 * Retries granted past the first attempt for transient failures.
 * Four retries ride out a burst gate:
 * at pack-count concurrency the dispatch burst alone can draw a 502 storm,
 * and the equal-jitter ladder spreads the survivors far enough apart.
 */
const TRANSIENT_RETRY_LIMIT = 4;

/**
 * Base backoff window before the first retry; doubles per retry.
 */
const RETRY_BACKOFF_BASE_MS = 1_000;

/**
 * Retry pacing knobs, injectable so tests run on tiny backoffs.
 *
 * @example
 * ```ts
 * const policy: RetryPolicy = { limit: 2, baseMs: 10, };
 * ```
 */
export type RetryPolicy = {
  /**
   * Retries granted past the first attempt.
   */
  readonly limit: number;

  /**
   * Backoff window before the first retry; doubles per retry.
   */
  readonly baseMs: number;
};

/**
 * Production retry pacing.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  limit: TRANSIENT_RETRY_LIMIT,
  baseMs: RETRY_BACKOFF_BASE_MS,
};

/**
 * Logger root for the transport retry layer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Computes one equal-jitter backoff:
 * half the exponential window fixed, half random,
 * so a burst of failing calls decorrelates instead of retrying in
 * lockstep and re-triggering the burst gate.
 *
 * @param baseMs - full window granted before the first retry
 *
 * @param attempt - zero-based index of the attempt that just failed
 *
 * @returns Milliseconds to wait before the next attempt
 *
 * @example
 * ```ts
 * const backoffMs = backoffDelayMs({ baseMs: 1_000, attempt: 0, },);
 * ```
 */
function backoffDelayMs(
  {
    baseMs,
    attempt,
  }: {
    readonly baseMs: number;
    readonly attempt: number;
  },
): number {
  /**
   * Full exponential window for this attempt.
   */
  const windowMs = baseMs * (2 ** attempt);
  return Math.floor(windowMs / 2,)
    + Math.floor(Math.random() * (windowMs / 2),);
}

/**
 * Outcome of one transport attempt with thrown failures captured as data,
 * so the retry loop treats bad statuses and dropped connections uniformly.
 */
type ExchangeAttemptOutcome =
  | {
    /**
     * The transport answered; the status may still be retryable.
     */
    readonly replied: true;

    /**
     * Reply of this attempt.
     */
    readonly reply: Awaited<ReturnType<ModelTransport>>;
  }
  | {
    /**
     * The transport threw mid-exchange, e.g. a connection reset while
     * draining the stream.
     */
    readonly replied: false;

    /**
     * Failure normalized to an Error for rethrow and logging.
     */
    readonly thrown: Error;
  };

/**
 * Performs one transport attempt, capturing non-abort throws as data.
 * A caller abort rethrows immediately:
 * user steering is never a transient failure.
 *
 * @param transport - HTTP seam performing the attempt
 *
 * @param exchange - request handed to the transport verbatim
 *
 * @mutates exchange - the delegated transport attempt may invoke getters
 * while serializing, and the exchange's `signal` rides into the attempt;
 * see the transport's own contract
 *
 * @returns Reply or captured failure, as data
 *
 * @example
 * ```ts
 * const outcome = await attemptExchange({ transport, exchange, },);
 * ```
 */
async function attemptExchange(
  {
    transport,
    exchange,
  }: {
    readonly transport: ModelTransport;
    readonly exchange: ForeignBorrowed<Parameters<ModelTransport>[0]>;
  },
): Promise<ExchangeAttemptOutcome> {
  try {
    return {
      replied: true,
      reply: await transport(exchange,),
    };
  }
  catch (error) {
    // A caller abort is steering, not weather; it must propagate untouched.
    if (exchange.signal
      .aborted)
      throw error;

    // NEITHER IS A TERMINATION THIS SYSTEM CHOSE. `drainBody` ends a runaway by
    // cancelling the reader and throwing, and it deliberately does NOT abort the
    // caller's signal, because the decision was ours rather than the caller's.
    // That leaves the check above blind to it, so without this the retry ladder
    // re-dispatches the runaway once per remaining attempt: measured at five
    // transport calls over twelve seconds of backoff under the production
    // policy. A model that has begun repeating itself will repeat itself again,
    // so every one of those attempts pays the same cost the guard exists to
    // avoid, and the guard ends up multiplying the waste it was built to stop.
    if (error instanceof StreamDegenerateError)
      throw error;

    return {
      replied: false,
      thrown: Error.isError(error,)
        ? error
        : new Error(String(error,),),
    };
  }
}

/**
 * Performs one exchange with bounded retry on transient failures:
 * retryable statuses and thrown transport failures both back off and
 * try again on an equal-jitter ladder.
 * Success and non-retryable statuses return immediately;
 * a caller abort stops retrying at the next boundary.
 *
 * @param transport - HTTP seam performing each attempt
 *
 * @param exchange - request repeated verbatim on every attempt
 *
 * @param policy - retry pacing; production default retries four times
 *
 * @mutates exchange - delegated transport attempts may invoke getters while
 * serializing, and the exchange's `signal` rides into each attempt;
 * see the transport's own contract
 *
 * @returns First success or first non-retryable reply
 *
 * @throws {@link SyntheticHttpError} when retries exhaust on a retryable status
 *
 * @example
 * ```ts
 * const reply = await exchangeWithRetry({ transport, exchange, },);
 * ```
 */
export async function exchangeWithRetry(
  {
    transport,
    exchange,
    policy = DEFAULT_RETRY_POLICY,
  }: {
    readonly transport: ModelTransport;
    readonly exchange: ForeignBorrowed<Parameters<ModelTransport>[0]>;
    readonly policy?: RetryPolicy;
  },
): Promise<Awaited<ReturnType<ModelTransport>>> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: exchangeWithRetry.name,
    l,
  },);

  for (
    let attempt = 0;
    attempt <= policy.limit;
    attempt += 1
  ) {
    /**
     * Reply or captured failure of this attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- attempts are inherently sequential; each retry depends on the previous failure
    const outcome = await attemptExchange({
      transport,
      exchange,
    },);

    /**
     * Whether attempts remain after this one.
     */
    const attemptsRemain = attempt < policy.limit;

    /**
     * Reply of this attempt when the transport answered.
     */
    const reply = outcome.replied
      ? outcome.reply
      : undefined;

    /**
     * Captured failure of this attempt when the transport dropped it.
     */
    const thrown = outcome.replied
      ? undefined
      : outcome.thrown;

    if (reply !== undefined) {
      /**
       * Whether this reply's status merits another attempt.
       */
      const retryable = RETRYABLE_STATUSES.has(reply.status,)
        && attemptsRemain;
      if (!retryable)
        return reply;
    }
    else if (!attemptsRemain) {
      throw nonNullishOrThrow(thrown,);
    }

    /**
     * Failure named in the retry log line.
     */
    const failureLabel = reply === undefined
      ? `transport failure: ${String(thrown,)}`
      : `HTTP ${String(reply.status,)}`;

    /**
     * Equal-jitter backoff for the coming retry.
     */
    const backoffMs = backoffDelayMs({
      baseMs: policy.baseMs,
      attempt,
    },);
    rl.warn(
      `${failureLabel}; retrying in ${String(backoffMs,)}ms (attempt ${
        String(attempt + 1,)
      } of ${String(policy.limit + 1,)})`,
    );
    // oxlint-disable-next-line no-await-in-loop -- backoff must complete before the dependent retry
    await wait(backoffMs,);
    // A caller abort during backoff stops the retry loop here; the aborted
    // signal would otherwise burn an attempt on a guaranteed rejection.
    if (exchange.signal
      .aborted) {
      if (reply !== undefined) {
        throw new SyntheticHttpError({
          status: reply.status,
          bodyText: reply.bodyText,
        },);
      }
      throw nonNullishOrThrow(thrown,);
    }
  }
  throw new Error('unreachable: retry loop returns or throws on its final attempt',);
}

//endregion Transient retry
