import type { CompletionUsage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  JsonSchemaResponseFormat,
  SyntheticClient,
} from '../chat-contract.ts';
import type { QuotaSnapshot, } from '../synthetic-quota.ts';

//region Bench record
// What one bench run costs, measured rather than asserted.
//
// The stage reports its own decisions, but nothing in it reports what those
// decisions COST, and cost is half of the roster-width question. This wraps the
// client so every exchange leaves a row: which schema was asked for, which
// model answered, how long it took, how many tokens it moved, and whether the
// answer was usable. Nothing about the pipeline changes; the wrapper observes.
//
// The stage is identified by the RESPONSE SCHEMA NAME rather than by a label
// the caller passes, because the caller here is `runTranslateStage` and it does
// not take one. The schema name is what actually distinguishes a translate call
// from a ballot or a repair turn.

/**
 * Characters of a thrown failure kept on its row, enough to tell a timeout from
 * a transport drop without carrying a stack into a summary.
 */
const FAILURE_DETAIL_CHARS = 40;

/**
 * One exchange, as the bench records it.
 *
 * @example
 * ```ts
 * const call: BenchCall = { schema: 'translate', modelId: 'hf:x', ms: 4200, tokens: 900, outcome: 'ok', };
 * ```
 */
export type BenchCall = {
  /**
   * Response schema asked for, which names the stage.
   */
  readonly schema: string;

  /**
   * Model asked.
   */
  readonly modelId: string;

  /**
   * Wall time of the exchange, retries included, since retries are part of
   * what a width costs.
   */
  readonly ms: number;

  /**
   * Tokens the server reported, zero when it reported none.
   */
  readonly tokens: number;

  /**
   * Outcome kind, or a truncated failure when the exchange raised.
   */
  readonly outcome: string;
};

/**
 * Client that records every exchange it forwards.
 *
 * @example
 * ```ts
 * const { client, calls, } = recordingClient({ inner: createRunClient(), },);
 * ```
 */
export type RecordingClient = {
  /**
   * Client to hand to the stage.
   */
  readonly client: SyntheticClient;

  /**
   * Rows accumulated so far; read after the run.
   */
  readonly calls: readonly BenchCall[];
};

/**
 * Names the stage of one request by the schema it asked for.
 *
 * @param request - exchange as the stage built it; free-text calls carry no
 * schema at all
 *
 * @returns Schema name, or `text` when none was asked for
 *
 * @example
 * ```ts
 * const schema = schemaOf({ request, },);
 * ```
 */
function schemaOf(
  { request, }: ForeignBorrowed<{
    readonly request: { readonly responseFormat?: JsonSchemaResponseFormat; };
  }>,
): string {
  return request.responseFormat
    ?.json_schema
    .name
    ?? 'text';
}

/**
 * Tokens one exchange moved, as the server reported them.
 *
 * @param answered - reply or outcome, whichever came back; both carry usage
 * only when the server reported it
 *
 * @returns Total tokens, falling back to the sum of both halves
 *
 * @example
 * ```ts
 * const tokens = tokensOf({ answered: outcome, },);
 * ```
 */
function tokensOf(
  { answered, }: ForeignBorrowed<{
    readonly answered: { readonly usage?: CompletionUsage; };
  }>,
): number {
  if (answered.usage === undefined)
    return 0;

  /**
   * First half the server always reports when it reports anything.
   */
  const prompt = answered.usage
    .prompt_tokens;

  /**
   * Second half of the same report.
   */
  const completion = answered.usage
    .completion_tokens;

  return answered.usage
    .total_tokens
    ?? (prompt + completion);
}

/**
 * Wraps a client so every exchange is timed, sized and classified.
 *
 * @param inner - client that actually talks to the provider
 *
 * @returns Wrapper plus the growing row list
 *
 * @example
 * ```ts
 * const recorder = recordingClient({ inner: createRunClient(), },);
 * ```
 */
export function recordingClient(
  { inner, }: ForeignBorrowed<{ readonly inner: SyntheticClient; }>,
): RecordingClient {
  /**
   * Rows this wrapper has recorded.
   */
  const calls: BenchCall[] = [];

  /**
   * Forwards a free-text exchange and records it.
   *
   * @param request - exchange as the stage built it
   *
   * @returns Whatever the inner client answered
   *
   * @example
   * ```ts
   * const reply = await chatText(request,);
   * ```
   */
  async function chatText(
    request: ForeignBorrowed<ChatTextRequest>,
  ): Promise<ChatTextReply> {
    /**
     * Start of this exchange.
     */
    const began = performance.now();

    /**
     * What the provider answered.
     */
    const reply = await inner.chatText(request,);
    calls.push({
      schema: schemaOf({ request, },),
      modelId: request.modelId,
      ms: performance.now() - began,
      tokens: tokensOf({ answered: reply, },),
      outcome: 'text',
    },);
    return reply;
  }

  /**
   * Forwards a schema-validated exchange and records it, thrown or not.
   *
   * @param request - exchange as the stage built it
   *
   * @returns Whatever the inner client answered
   *
   * @throws Whatever the inner client threw, after recording the attempt
   *
   * @example
   * ```ts
   * const outcome = await chatJson(request,);
   * ```
   */
  async function chatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    /**
     * Start of this exchange.
     */
    const began = performance.now();
    try {
      /**
       * Outcome as data, which the stage reads either way.
       */
      const outcome = await inner.chatJson(request,);
      calls.push({
        schema: schemaOf({ request, },),
        modelId: request.modelId,
        ms: performance.now() - began,
        tokens: tokensOf({ answered: outcome, },),
        outcome: outcome.kind,
      },);
      return outcome;
    }
    catch (error) {
      // A throw is a cost too, and the commonest one under provider load is a
      // transport failure after several retries. Recording it before rethrowing
      // keeps the row and leaves the stage's own handling alone.
      /**
       * What failed, trimmed so a summary row carries no stack.
       */
      const detail = String(error,)
        .slice(
          0,
          FAILURE_DETAIL_CHARS,
        );
      calls.push({
        schema: schemaOf({ request, },),
        modelId: request.modelId,
        ms: performance.now() - began,
        tokens: 0,
        outcome: `threw ${detail}`,
      },);
      throw error;
    }
  }

  /**
   * Forwards a quota read unrecorded, since it costs no generation.
   *
   * @param args - abort signal the caller owns
   *
   * @returns Snapshot the inner client returned
   *
   * @example
   * ```ts
   * const snapshot = await quotas({ signal, },);
   * ```
   */
  async function quotas(
    args: { readonly signal: AbortSignal; },
  ): Promise<QuotaSnapshot> {
    return await inner.quotas(args,);
  }

  return {
    calls,
    client: {
      chatText,
      chatJson,
      quotas,
    },
  };
}

//endregion Bench record
