/**
 * Tests for the transport-level transient retry.
 *
 * `exchangeWithRetry` had no test. It sits under every model call in the
 * pipeline, so its two failure modes are both expensive: retrying something
 * permanent burns the flat-rate provider's capacity on a guaranteed rejection,
 * and NOT retrying something transient throws away a voice the ensemble needed,
 * which shows up much later as a thinner quorum rather than as an error.
 *
 * The abort case gets the most attention. A caller abort during backoff must
 * stop the loop rather than burn the remaining attempts, and it must surface
 * the failure that actually happened rather than a generic one.
 *
 * Every case uses a tiny backoff base so the suite stays fast; the delay
 * arithmetic is jittered and is not what these assert.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type ModelTransport,
  StreamDegenerateError,
  SyntheticHttpError,
  type TransportReply,
} from '../dist/final/node/index.mjs';

/**
 * Retry policy with a backoff small enough to keep the suite quick.
 */
const FAST_POLICY = {
  limit: 2,
  baseMs: 1,
};

/**
 * Builds the exchange every case sends.
 *
 * @param signal - caller abort handle
 *
 * @returns Exchange the transport receives
 *
 * @example
 * ```ts
 * const exchange = exchangeWith({ signal: new AbortController().signal, },);
 * ```
 */
function exchangeWith({ signal, }: { readonly signal: AbortSignal; },) {
  return {
    url: 'https://example.invalid/chat',
    label: 'hf:whiskers',
    method: 'POST' as const,
    headers: { 'content-type': 'application/json', },
    bodyJson: JSON.stringify({ prompt: 'Does the cat purr?', },),
    signal,
  };
}

/**
 * Transport replaying a scripted list of replies and failures, recording how
 * many times it was called.
 *
 * @param script - one entry per expected attempt; an Error is thrown, a reply
 * is returned
 *
 * @param calls - shared counter the cases assert on
 *
 * @returns Transport honoring the script
 *
 * @example
 * ```ts
 * const transport = scriptedTransport({ script: [okReply,], calls, },);
 * ```
 */
function scriptedTransport(
  {
    script,
    calls,
  }: {
    readonly script: readonly (TransportReply | Error)[];
    readonly calls: { count: number; };
  },
): ModelTransport {
  return async function transport() {
    /**
     * Entry for this attempt; the last entry repeats once the script runs out.
     */
    const entry = script[calls.count] ?? script.at(-1,);
    calls.count += 1;
    if (Error.isError(entry,))
      throw entry;
    if (entry === undefined)
      throw new Error('scripted transport ran out of entries',);
    return entry;
  };
}

/**
 * Successful reply used wherever the content does not matter.
 */
const OK_REPLY: TransportReply = {
  status: 200,
  bodyText: '{"purr":"loud"}',
};

await describe({
  name: exchangeWithRetry.name,
  children: [
    it({
      name: 'returns a success on the first attempt without retrying, so a '
        + 'healthy call costs exactly one request',
      fn: async () => {
        /**
         * Attempt counter for this case.
         */
        const calls = { count: 0, };

        expect(
          await exchangeWithRetry({
            transport: scriptedTransport({
              script: [OK_REPLY,],
              calls,
            },),
            exchange: exchangeWith({ signal: new AbortController().signal, },),
            policy: FAST_POLICY,
          },),
        ).toStrictEqual(OK_REPLY,);
        expect(calls.count,).toBe(1,);
      },
    },),

    it({
      name: 'RETURNS a non-retryable status immediately rather than retrying '
        + 'it, because burning the retry budget on a permanent rejection costs '
        + 'provider capacity the run needs elsewhere and cannot succeed',
      fn: async () => {
        // Concurrent because each status gets its own transport and counter,
        // so nothing here is a sequence.
        await Promise.all([
          400,
          401,
          404,
          422,
        ].map(async function expectNoRetry(status,) {
          /**
           * Attempt counter for this status.
           */
          const calls = { count: 0, };

          /**
           * Reply carrying the non-retryable status.
           */
          const reply: TransportReply = {
            status,
            bodyText: 'no',
          };

          expect(
            await exchangeWithRetry({
              transport: scriptedTransport({
                script: [reply,],
                calls,
              },),
              exchange: exchangeWith({ signal: new AbortController().signal, },),
              policy: FAST_POLICY,
            },),
          ).toStrictEqual(reply,);
          expect(calls.count,).toBe(1,);
        },),);
      },
    },),

    it({
      name: 'RETRIES every transient status and returns the eventual success, '
        + 'since these are exactly the statuses a flat-rate provider emits '
        + 'under load and giving up on them loses a voice the ensemble needed',
      fn: async () => {
        // Concurrent for the same reason: one transport and counter per status.
        await Promise.all([
          408,
          429,
          500,
          502,
          503,
          504,
        ].map(async function expectRetry(status,) {
          /**
           * Attempt counter for this status.
           */
          const calls = { count: 0, };

          expect(
            await exchangeWithRetry({
              transport: scriptedTransport({
                script: [
                  {
                    status,
                    bodyText: 'busy',
                  },
                  OK_REPLY,
                ],
                calls,
              },),
              exchange: exchangeWith({ signal: new AbortController().signal, },),
              policy: FAST_POLICY,
            },),
          ).toStrictEqual(OK_REPLY,);
          expect(calls.count,).toBe(2,);
        },),);
      },
    },),

    it({
      name: 'returns the last retryable reply once attempts exhaust rather '
        + 'than throwing, so the caller sees the status the provider actually '
        + 'gave and can record it instead of guessing',
      fn: async () => {
        /**
         * Attempt counter across the exhausted budget.
         */
        const calls = { count: 0, };

        /**
         * Reply the provider keeps giving.
         */
        const busy: TransportReply = {
          status: 503,
          bodyText: 'still busy',
        };

        expect(
          await exchangeWithRetry({
            transport: scriptedTransport({
              script: [busy,],
              calls,
            },),
            exchange: exchangeWith({ signal: new AbortController().signal, },),
            policy: FAST_POLICY,
          },),
        ).toStrictEqual(busy,);
        // One initial attempt plus the policy's retries.
        expect(calls.count,).toBe(FAST_POLICY.limit + 1,);
      },
    },),

    it({
      name: 'retries a THROWN transport failure and succeeds later, since a '
        + 'dropped connection is the commonest transient failure and never '
        + 'arrives as a status at all',
      fn: async () => {
        /**
         * Attempt counter for this case.
         */
        const calls = { count: 0, };

        expect(
          await exchangeWithRetry({
            transport: scriptedTransport({
              script: [
                new Error('connection reset',),
                OK_REPLY,
              ],
              calls,
            },),
            exchange: exchangeWith({ signal: new AbortController().signal, },),
            policy: FAST_POLICY,
          },),
        ).toStrictEqual(OK_REPLY,);
        expect(calls.count,).toBe(2,);
      },
    },),

    it({
      name: 'rethrows the ORIGINAL transport failure once retries exhaust, not '
        + 'a wrapper, so the cause survives to whoever reads the log',
      fn: async () => {
        /**
         * Attempt counter across the exhausted budget.
         */
        const calls = { count: 0, };

        await expect(
          exchangeWithRetry({
            transport: scriptedTransport({
              script: [new Error('connection reset',),],
              calls,
            },),
            exchange: exchangeWith({ signal: new AbortController().signal, },),
            policy: FAST_POLICY,
          },),
        ).rejects.toThrow('connection reset',);
        expect(calls.count,).toBe(FAST_POLICY.limit + 1,);
      },
    },),

    it({
      name: 'STOPS RETRYING once the caller aborts during backoff, rather than '
        + 'spending the remaining attempts on calls that are guaranteed to '
        + 'fail: the abort is what the user asked for and the budget belongs '
        + 'to the rest of the run',
      fn: async () => {
        /**
         * Attempt counter, so a stopped loop is visible as a call count.
         */
        const calls = { count: 0, };

        /**
         * Caller abort tripped as soon as the first attempt fails.
         */
        const controller = new AbortController();

        /**
         * Transport that aborts the caller while failing transiently.
         */
        const transport: ModelTransport = async () => {
          calls.count += 1;
          controller.abort();
          return {
            status: 503,
            bodyText: 'busy',
          };
        };

        await expect(
          exchangeWithRetry({
            transport,
            exchange: exchangeWith({ signal: controller.signal, },),
            policy: {
              limit: 5,
              baseMs: 1,
            },
          },),
        ).rejects.toThrow(SyntheticHttpError,);
        // One attempt, then the abort stops the loop instead of five more.
        expect(calls.count,).toBe(1,);
      },
    },),

    it({
      name: 'surfaces the STATUS that was failing when the caller aborted, so '
        + 'an abort during a rate-limit storm is still recognizable as a rate '
        + 'limit rather than as a bare cancellation',
      fn: async () => {
        /**
         * Caller abort tripped during the first backoff.
         */
        const controller = new AbortController();

        /**
         * Transport reporting rate limiting, then aborting the caller.
         */
        const transport: ModelTransport = async () => {
          controller.abort();
          return {
            status: 429,
            bodyText: 'slow down',
          };
        };

        await expect(
          exchangeWithRetry({
            transport,
            exchange: exchangeWith({ signal: controller.signal, },),
            policy: FAST_POLICY,
          },),
        ).rejects.toThrow(SyntheticHttpError,);
      },
    },),

    it({
      name: 'surfaces the THROWN failure when the caller aborts after a '
        + 'transport drop, rather than replacing it with an HTTP error it '
        + 'never received',
      fn: async () => {
        /**
         * Caller abort tripped during the first backoff.
         */
        const controller = new AbortController();

        /**
         * Transport dropping the connection, then aborting the caller.
         */
        const transport: ModelTransport = async () => {
          controller.abort();
          throw new Error('connection reset',);
        };

        await expect(
          exchangeWithRetry({
            transport,
            exchange: exchangeWith({ signal: controller.signal, },),
            policy: FAST_POLICY,
          },),
        ).rejects.toThrow('connection reset',);
      },
    },),

    it({
      name: 'defaults to the shipped policy when none is given, so a caller '
        + 'that omits it gets the tuned budget rather than no retries at all',
      fn: async () => {
        /**
         * Attempt counter under the default policy.
         */
        const calls = { count: 0, };

        expect(
          await exchangeWithRetry({
            transport: scriptedTransport({
              script: [
                new Error('connection reset',),
                OK_REPLY,
              ],
              calls,
            },),
            exchange: exchangeWith({ signal: new AbortController().signal, },),
          },),
        ).toStrictEqual(OK_REPLY,);
        expect(calls.count,).toBe(2,);
        expect(DEFAULT_RETRY_POLICY.limit,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'REFUSES TO RE-DISPATCH A CALL THIS SYSTEM ENDED ON PURPOSE, because a model that has '
        + 'begun repeating itself will repeat itself again. Treating a runaway as weather turns one '
        + 'of them into one per attempt the ladder grants, which multiplies the exact cost the '
        + 'degeneration guard exists to avoid',
      fn: async () => {
        /**
         * Attempt counter, which is the whole assertion: the error's identity
         * would look right even if the transport had been called five times.
         */
        const calls = { count: 0, };

        /**
         * What the drain throws once it has cancelled a runaway reader. The
         * caller's signal is NOT aborted on this path, because the termination
         * is ours rather than the caller's steering, so nothing else in the
         * retry loop marks it as permanent.
         */
        const runaway = new StreamDegenerateError({
          label: 'hf:whiskers',
          channel: 'reasoning',
          distinctRatio: 0.0037,
          charsSeen: 131_475,
        },);

        /**
         * What the call did, as a value, so the assertion reads as an
         * expectation rather than as control flow.
         */
        const raised = await (async function attempt(): Promise<unknown> {
          try {
            await exchangeWithRetry({
              transport: scriptedTransport({
                script: [runaway,],
                calls,
              },),
              exchange: exchangeWith({ signal: new AbortController().signal, },),
              policy: FAST_POLICY,
            },);
            return undefined;
          }
          catch (error) {
            return error;
          }
        })();

        expect(raised,).toBeInstanceOf(StreamDegenerateError,);
        expect(calls.count,).toBe(1,);
      },
    },),
  ],
},);
