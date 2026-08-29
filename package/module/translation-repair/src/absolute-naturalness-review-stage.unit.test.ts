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
  hashContent,
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
  }: {
    readonly client: SyntheticClient;
    readonly messages?: string[];
  },
): ReturnType<typeof reviewAbsoluteNaturalness> {
  return await reviewAbsoluteNaturalness({
    client,
    modelIds: ROSTER,
    subject: {
      sourceText: '猫猫在窗台上睡觉。',
      candidateText: 'The cat sleeps on the windowsill.',
      paragraphs: ['The cat sleeps on the windowsill.',],
    },
    signal: AbortSignal.timeout(5_000,),
    exchangeTimeoutMs: 5_000,
    graceMs: 0,
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
      name: 'WAITS FOR DELAYED REJECTION instead of ending on early acceptable quorum',
      fn: async () => {
        const messages: string[] = [];
        const review = await runReview({
          client: reviewClient({
            rejecting: ROSTER[2],
            delayed: true,
          },),
          messages,
        },);
        expect(review.verdict,).toBe('unacceptable',);
        /**
         * Digest expected instead of raw finding wording.
         */
        const findingDigest = hashContent({
          content: 'Replace stiff source-language word order.',
        },);
        expect(messages.some(function carriesSeatSummary(line,): boolean {
          if (!line.includes(
            'hf:zai-org/GLM-5.3-Flash:acceptable:findings=0:paragraphs=none:digests=none',
          ))
            return false;
          if (!line.includes(
            `hf:moonshotai/Kimi-K3:unacceptable:findings=1:paragraphs=1:digests=${findingDigest}`,
          ))
            return false;
          if (!line.includes('uniqueFindings=1',))
            return false;
          if (line.includes('Replace stiff source-language word order.',))
            return false;
          return !line.includes('candidate retains translationese',);
        },),).toBe(true,);
        expect(review.findings,).toEqual([{
          paragraph: 1,
          problem: 'Replace stiff source-language word order.',
        },],);
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
