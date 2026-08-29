/**
 * Tests independent absolute naturalness review settlement and delayed rejection.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  reviewAbsoluteNaturalness,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Invented reviewer roster.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Even reviewer roster making exact-half quorum visible.
 */
const SIX_SEAT_ROSTER = [
  ...ROSTER,
  'deepseek-v4-flash-0731',
  'deepseek-v4-pro-0813',
  'minimax-m3',
] as const;

/**
 * Builds logger retaining operational messages for assertions.
 *
 * @param messages - destination in emission order
 *
 * @returns Logger appending every level to destination
 *
 * @example
 * ```ts
 * const messages: string[] = [];
 * const l = capturingLogger({ messages, },);
 * ```
 */
function capturingLogger({ messages, }: { readonly messages: string[]; },): Logger {
  /**
   * Retains one emitted message.
   */
  function keep(message: string,): void {
    messages.push(message,);
  }

  return {
    debug: keep,
    error: keep,
    fatal: keep,
    info: keep,
    trace: keep,
    warn: keep,
    flush: async function flush(): Promise<void> {},
  };
}

/**
 * Builds reviewer client from per-model status and optional delayed rejection.
 *
 * @param unavailable - models returning no usable structured reply
 *
 * @param rejecting - model returning actionable rejection
 *
 * @param delayed - whether rejecting model answers after accepting peers
 *
 * @returns Scripted absolute reviewer
 *
 * @example
 * ```ts
 * const client = reviewClient({ rejecting: ROSTER[2], delayed: true, });
 * ```
 */
function reviewClient(
  {
    unavailable = [],
    rejecting,
    delayed = false,
  }: {
    readonly unavailable?: readonly RosterModelId[];
    readonly rejecting?: RosterModelId;
    readonly delayed?: boolean;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by absolute review',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if (delayed && (request.modelId === rejecting))
        await wait(30,);
      if (unavailable.includes(request.modelId,)) {
        return {
          kind: 'schema-mismatch',
          rawText: '{}',
          detail: 'scripted unusable seat',
        };
      }
      /**
       * Candidate verdict for this seat.
       */
      const value: unknown = (request.modelId === rejecting)
        ? {
          acceptable: false,
          findings: [{
            paragraph: 1,
            problem: 'Replace stiff source-language word order.',
          },],
          reason: 'candidate retains translationese',
        }
        : {
          acceptable: true,
          findings: [],
          reason: 'whole candidate is publication-ready',
        };
      if (!request.validate(value,))
        throw new Error('scripted absolute review failed validation',);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by absolute review',);
    },
  };
}

/**
 * Runs one invented absolute review.
 *
 * @param client - scripted reviewer
 *
 * @param messages - optional destination for operational logging
 *
 * @param modelIds - reviewer roster, defaulting to three-seat fixture
 *
 * @param graceMs - bounded time to retain post-quorum responses
 *
 * @returns Absolute review outcome
 *
 * @example
 * ```ts
 * const review = await runReview({ client, });
 * ```
 */
async function runReview(
  {
    client,
    messages,
    modelIds = ROSTER,
    graceMs = 0,
  }: {
    readonly client: SyntheticClient;
    readonly messages?: string[];
    readonly modelIds?: readonly RosterModelId[];
    readonly graceMs?: number;
  },
): ReturnType<typeof reviewAbsoluteNaturalness> {
  return await reviewAbsoluteNaturalness({
    client,
    modelIds,
    subject: {
      sourceText: '猫猫在窗台上睡觉。',
      candidateText: 'The cat sleeps on the windowsill.',
      paragraphs: ['The cat sleeps on the windowsill.',],
    },
    signal: AbortSignal.timeout(5_000,),
    exchangeTimeoutMs: 5_000,
    graceMs,
    l: (messages === undefined)
      ? tagged({ tag: 'absolute-review-test', },)
      : capturingLogger({ messages, },),
  },);
}

await describe({
  name: reviewAbsoluteNaturalness.name,
  children: [
    it({
      name: 'ACCEPTS only when every usable reviewer accepts and quorum stands',
      fn: async () => {
        const review = await runReview({ client: reviewClient({}), },);
        expect(review.verdict,).toBe('acceptable',);
        expect(review.usable,).toBe(3,);
        expect(review.seats.map(function status(seat,): string {
          return seat.status;
        },),).toEqual([
          'acceptable',
          'acceptable',
          'acceptable',
        ],);
      },
    },),

    it({
      name: 'STARTS GRACE AT HALF instead of requiring delayed final seat',
      fn: async () => {
        const messages: string[] = [];
        const review = await runReview({
          client: reviewClient({
            rejecting: ROSTER[2],
            delayed: true,
          },),
          messages,
        },);
        expect(review.verdict,).toBe('acceptable',);
        expect(review.usable,).toBe(2,);
        expect(review.seats.map(function status(seat,): string {
          return seat.status;
        },),).toEqual([
          'acceptable',
          'acceptable',
          'unusable',
        ],);
        expect(review.findings,).toEqual([],);
        expect(messages.some(function leaksPrivateReview(line,): boolean {
          return line.includes('Replace stiff source-language word order.',)
            || line.includes('candidate retains translationese',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS REJECTION that arrives inside bounded post-quorum grace',
      fn: async () => {
        const review = await runReview({
          client: reviewClient({
            rejecting: ROSTER[2],
            delayed: true,
          },),
          graceMs: 100,
        },);
        expect(review.verdict,).toBe('unacceptable',);
        expect(review.usable,).toBe(3,);
        expect(review.findings,).toEqual([{
          paragraph: 1,
          problem: 'Replace stiff source-language word order.',
        },],);
      },
    },),

    it({
      name: 'REFUSES TWO USABLE SEATS when six-seat roster needs exact half',
      fn: async () => {
        const review = await runReview({
          client: reviewClient({
            unavailable: SIX_SEAT_ROSTER.slice(2,),
          },),
          modelIds: SIX_SEAT_ROSTER,
        },);
        expect(review.verdict,).toBe('quorum-not-met',);
        expect(review.usable,).toBe(2,);
      },
    },),

    it({
      name: 'REFUSES THIN REVIEW with one usable seat',
      fn: async () => {
        const review = await runReview({
          client: reviewClient({
            unavailable: [
              ROSTER[1],
              ROSTER[2],
            ],
          },),
        },);
        expect(review.verdict,).toBe('quorum-not-met',);
        expect(review.usable,).toBe(1,);
      },
    },),
  ],
},);
