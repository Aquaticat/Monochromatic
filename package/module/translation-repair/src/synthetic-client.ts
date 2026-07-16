import type {
  ChatMessage,
  CompletionUsage,
} from '@monochromatic-dev/module-llm-type/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import pLimit, { type LimitFunction, } from 'p-limit';

import {
  extractCompletion,
  type ExtractedCompletion,
  SyntheticHttpError,
} from './completion-shape.ts';
import { detectRefusalShape, } from './refusal.ts';
import {
  SYNTHETIC_CHAT_BASE_URL,
  SYNTHETIC_QUOTAS_URL,
  type SyntheticModelId,
} from './synthetic-catalog.ts';
import {
  parseQuotaSnapshot,
  type QuotaSnapshot,
} from './synthetic-quota.ts';
import {
  fetchTransport,
  type ModelTransport,
} from './synthetic-transport.ts';

//region Synthetic client
// Imperative-shell client over the Synthetic API. Provider protocol failures throw;
// model-content defects (refusal-shaped replies, schema mismatches) flow as data
// because unreliable model output is an ordinary input to this pipeline. Every call
// requires an AbortSignal so user steering can always abort in-flight fan-outs, and
// requests to one model serialize locally (provider grants 1 concurrent request per
// model; local serialization keeps queues short and aborts responsive).

/**
 * Lowest HTTP status treated as success.
 */
const HTTP_SUCCESS_MIN = 200;

/**
 * First HTTP status past the success family.
 */
const HTTP_SUCCESS_MAX_EXCLUSIVE = 300;

/**
 * Logger root for this package's model-facing shell.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * OpenAI-style structured-output constraint;
 * every catalog model advertises `structured_outputs`,
 * but client-side validation stays because per-model strictness is unverified.
 *
 * @example
 * ```ts
 * const format: JsonSchemaResponseFormat = {
 *   type: 'json_schema',
 *   json_schema: { name: 'issue_claims', schema: { type: 'object', }, },
 * };
 * ```
 */
export type JsonSchemaResponseFormat = {
  /**
   * Discriminator the OpenAI-compatible API expects.
   */
  readonly type: 'json_schema';

  /**
   * Schema envelope: name, optional strictness, JSON schema body.
   */
  readonly json_schema: {
    /**
     * Identifier the API requires per schema.
     */
    readonly name: string;

    /**
     * Whether the server should enforce the schema strictly.
     */
    readonly strict?: boolean;

    /**
     * JSON schema constraining the completion.
     */
    readonly schema: Record<string, unknown>;
  };
};

/**
 * One chat exchange request.
 *
 * @example
 * ```ts
 * const request: ChatTextRequest = {
 *   modelId: 'hf:zai-org/GLM-4.7-Flash',
 *   messages: [{ role: 'user', content: '喵？', },],
 *   signal: AbortSignal.timeout(120_000,),
 * };
 * ```
 */
export type ChatTextRequest = {
  /**
   * Catalog model receiving the exchange.
   */
  readonly modelId: SyntheticModelId;

  /**
   * Conversation sent as-is.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Abort signal honored for the whole exchange, wait included.
   */
  readonly signal: AbortSignal;

  /**
   * Completion token cap when the caller bounds output.
   */
  readonly maxTokens?: number;

  /**
   * Sampling temperature when the caller pins it.
   */
  readonly temperature?: number;

  /**
   * Structured-output constraint when the caller expects JSON.
   */
  readonly responseFormat?: JsonSchemaResponseFormat;
};

/**
 * Raw text outcome of one chat exchange.
 *
 * @example
 * ```ts
 * const reply: ChatTextReply = { text: '喵。', };
 * ```
 */
export type ChatTextReply = {
  /**
   * Verbatim content of the first choice.
   */
  readonly text: string;

  /**
   * Token usage when the server reported it.
   */
  readonly usage?: CompletionUsage;
};

/**
 * One schema-validated chat request:
 * text request plus the guard that admits parsed content.
 *
 * @example
 * ```ts
 * const request: ChatJsonRequest<Verdict> = { ...textRequest, validate: isVerdict, };
 * ```
 */
export type ChatJsonRequest<ValueT,> = ChatTextRequest & {
  /**
   * Guard admitting parsed model JSON into the typed pipeline.
   */
  readonly validate: (value: unknown,) => value is ValueT;
};

/**
 * Outcome of one schema-validated chat exchange.
 * Refusals and mismatches are data (reroute and scorecard), never exceptions.
 *
 * @example
 * ```ts
 * const outcome: ChatJsonOutcome<Verdict> = { kind: 'ok', value, rawText, };
 * ```
 */
export type ChatJsonOutcome<ValueT,> =
  | {
    /**
     * Content parsed and validated.
     */
    readonly kind: 'ok';

    /**
     * Typed content admitted by the caller's guard.
     */
    readonly value: ValueT;

    /**
     * Verbatim model text for audit trails.
     */
    readonly rawText: string;
  }
  | {
    /**
     * Opening reads as a refusal; reroute cross-family.
     */
    readonly kind: 'refusal-shaped';

    /**
     * Verbatim model text for audit trails.
     */
    readonly rawText: string;

    /**
     * Refusal marker that fired; feeds the scorecard.
     */
    readonly marker: string;
  }
  | {
    /**
     * Content is not valid JSON or failed the caller's guard.
     */
    readonly kind: 'schema-mismatch';

    /**
     * Verbatim model text for audit trails.
     */
    readonly rawText: string;

    /**
     * What failed: parse step or guard.
     */
    readonly detail: string;
  };

/**
 * Injected-transport client surface drivers consume.
 *
 * @example
 * ```ts
 * const client: SyntheticClient = createSyntheticClient({ apiKey, },);
 * ```
 */
export type SyntheticClient = {
  /**
   * Free-text chat exchange.
   */
  readonly chatText: (request: ForeignBorrowed<ChatTextRequest>,) => Promise<ChatTextReply>;

  /**
   * Schema-validated chat exchange returning outcomes as data.
   */
  readonly chatJson: <ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ) => Promise<ChatJsonOutcome<ValueT>>;

  /**
   * Current quota snapshot; free per provider docs.
   */
  readonly quotas: (args: { readonly signal: AbortSignal; },) => Promise<QuotaSnapshot>;
};

/**
 * Strips one wrapping markdown code fence when present,
 * because models wrap JSON in fences despite instructions.
 * Single linear pass over fence positions; inner text is returned trimmed.
 *
 * @param text - model content possibly wrapped in a fence
 *
 * @returns Inner text when fenced, trimmed input otherwise
 *
 * @example
 * ```ts
 * stripCodeFence({ text: '```json\n{"a":1}\n```', },);
 * ```
 */
export function stripCodeFence({ text, }: { readonly text: string; },): string {
  /**
   * Input without surrounding whitespace so fence detection sees column zero.
   */
  const trimmed = text.trim();
  if (!trimmed.startsWith('```',))
    return trimmed;

  /**
   * End of the opening fence line (language tag included).
   */
  const openingEnd = trimmed.indexOf('\n',);
  if (openingEnd === (-1))
    return trimmed;

  /**
   * Start of the closing fence; must sit after the opening line.
   */
  const closingStart = trimmed.lastIndexOf('```',);
  if (closingStart <= openingEnd)
    return trimmed;

  return trimmed
    .slice(
      openingEnd + 1,
      closingStart,
    )
    .trim();
}

/**
 * Parse attempt over model-written JSON;
 * failure is data because model content defects are ordinary.
 *
 * @param text - fence-stripped model content
 *
 * @returns Parsed value, or failure detail
 *
 * @example
 * ```ts
 * const attempt = parseModelJson({ text: stripped, },);
 * ```
 */
function parseModelJson({ text, }: { readonly text: string; },):
  | {
    readonly parsed: true;
    readonly value: unknown;
  }
  | {
    readonly parsed: false;
    readonly detail: string;
  }
{
  try {
    return {
      parsed: true,
      value: JSON.parse(text,),
    };
  }
  catch (error) {
    return {
      parsed: false,
      detail: String(error,),
    };
  }
}

/**
 * Formats the token-usage suffix of a completion log line.
 *
 * @param extracted - completion whose usage the log line reports
 *
 * @returns Usage suffix, empty when the server reported none
 *
 * @example
 * ```ts
 * rl.debug(`done${formatUsageNote({ extracted, },)}`,);
 * ```
 */
function formatUsageNote(
  { extracted, }: { readonly extracted: ExtractedCompletion; },
): string {
  if (extracted.usage === undefined)
    return '';

  /**
   * Component token counts pulled out for the log line.
   */
  const {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  } = extracted.usage;

  return `, ${String(promptTokens,)}+${String(completionTokens,)} tokens`;
}

/**
 * Builds one client over injected transport.
 * Requests to the same model serialize through a local single-slot limiter;
 * different models run fully parallel, matching provider concurrency rules.
 *
 * @param apiKey - bearer token; never logged
 *
 * @param transport - HTTP seam; tests inject recorded replies
 *
 * @param chatBaseUrl - OpenAI-compatible base, overridable for tests
 *
 * @param quotasUrl - quota endpoint, overridable for tests
 *
 * @returns Client surface with chatText, chatJson, and quotas
 *
 * @example
 * ```ts
 * const client = createSyntheticClient({ apiKey: process.env['TRANSLATION_REPAIR_SYNTHETIC_API_KEY'] ?? '', },);
 * ```
 */
export function createSyntheticClient(
  {
    apiKey,
    transport = fetchTransport,
    chatBaseUrl = SYNTHETIC_CHAT_BASE_URL,
    quotasUrl = SYNTHETIC_QUOTAS_URL,
  }: {
    readonly apiKey: string;
    readonly transport?: ModelTransport;
    readonly chatBaseUrl?: string;
    readonly quotasUrl?: string;
  },
): SyntheticClient {
  /**
   * Single-slot limiters keyed by model, created lazily;
   * bounded by catalog size.
   */
  const limiters = new Map<SyntheticModelId, LimitFunction>();

  /**
   * Headers shared by every exchange.
   */
  const headers: Readonly<Record<string, string>> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  /**
   * Returns the model's limiter, creating its single slot on first use.
   *
   * @param modelId - model whose slot the exchange needs
   *
   * @returns Single-slot limiter for the model
   *
   * @example
   * ```ts
   * const limit = limiterFor('hf:zai-org/GLM-5.2',);
   * ```
   */
  function limiterFor(modelId: SyntheticModelId,): LimitFunction {
    /**
     * Existing limiter when this model was called before.
     */
    const existing = limiters.get(modelId,);
    if (existing !== undefined)
      return existing;

    /**
     * Fresh single-slot limiter for first use of this model.
     */
    const created = pLimit(1,);
    limiters.set(
      modelId,
      created,
    );
    return created;
  }

  /**
   * Free-text chat exchange; serialized per model.
   *
   * @param request - exchange to perform
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while serializing messages and response format
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./completion-shape.ts').MalformedCompletionError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const reply = await client.chatText({ modelId, messages, signal, },);
   * ```
   */
  function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatText.name,
      l,
    },);

    /**
     * Message count for the entry log line.
     */
    const messageCount = request
      .messages
      .length;

    return limiterFor(request.modelId,)(async function performExchange() {
      rl.debug(
        `-> ${request.modelId}: ${String(messageCount,)} messages`,
      );

      /**
       * Raw reply from the transport seam.
       */
      const reply = await transport({
        url: `${chatBaseUrl}/chat/completions`,
        method: 'POST',
        headers,
        bodyJson: JSON.stringify({
          model: request.modelId,
          messages: request.messages,
          // Conditional spreads keep optional knobs absent instead of undefined.
          ...(request.maxTokens === undefined
            ? {}
            : { max_tokens: request.maxTokens, }),
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature, }),
          ...(request.responseFormat === undefined
            ? {}
            : { response_format: request.responseFormat, }),
        },),
        signal: request.signal,
      },);

      if ((reply.status < HTTP_SUCCESS_MIN) || (reply.status >= HTTP_SUCCESS_MAX_EXCLUSIVE)) {
        rl.warn(`<- ${request.modelId}: HTTP ${String(reply.status,)}`,);
        throw new SyntheticHttpError({
          status: reply.status,
          bodyText: reply.bodyText,
        },);
      }

      /**
       * Content and usage validated against the completion contract.
       */
      const extracted = extractCompletion({ bodyText: reply.bodyText, },);

      /**
       * Content length for the completion log line.
       */
      const textLength = extracted
        .text
        .length;
      rl.debug(
        `<- ${request.modelId}: ${String(textLength,)} chars${formatUsageNote({ extracted, },)}`,
      );
      return extracted;
    },);
  }

  /**
   * Schema-validated chat exchange.
   * Content that parses and passes the guard wins even when it quotes
   * refusal-like phrasing; the refusal scan runs only on parse failure.
   *
   * @param request - exchange plus content guard
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while the delegated exchange serializes messages and response format
   *
   * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @example
   * ```ts
   * const outcome = await client.chatJson({ modelId, messages, signal, validate: isVerdict, },);
   * ```
   */
  async function chatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatJson.name,
      l,
    },);

    /**
     * Raw text reply of the underlying exchange.
     */
    const reply = await chatText({
      modelId: request.modelId,
      messages: request.messages,
      signal: request.signal,
      // Conditional spreads keep optional knobs absent instead of undefined.
      ...(request.maxTokens === undefined
        ? {}
        : { maxTokens: request.maxTokens, }),
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature, }),
      ...(request.responseFormat === undefined
        ? {}
        : { responseFormat: request.responseFormat, }),
    },);

    /**
     * Parse attempt over fence-stripped content.
     */
    const attempt = parseModelJson({ text: stripCodeFence({ text: reply.text, },), },);

    if (!attempt.parsed) {
      /**
       * Refusal classification of the unparseable reply.
       */
      const scan = detectRefusalShape({ text: reply.text, },);
      if (scan.refusalShaped) {
        rl.debug(`${request.modelId}: refusal-shaped (${scan.marker})`,);
        return {
          kind: 'refusal-shaped',
          rawText: reply.text,
          marker: scan.marker,
        };
      }
      rl.debug(`${request.modelId}: schema-mismatch (unparseable)`,);
      return {
        kind: 'schema-mismatch',
        rawText: reply.text,
        detail: `content is not valid JSON: ${attempt.detail}`,
      };
    }

    /**
     * Parsed content awaiting the caller's guard.
     */
    const candidate = attempt.value;
    if (!request.validate(candidate,)) {
      rl.debug(`${request.modelId}: schema-mismatch (guard rejected)`,);
      return {
        kind: 'schema-mismatch',
        rawText: reply.text,
        detail: 'content parsed as JSON but failed the caller schema guard',
      };
    }

    return {
      kind: 'ok',
      value: candidate,
      rawText: reply.text,
    };
  }

  /**
   * Reads the current quota snapshot.
   *
   * @param signal - abort signal honored for the read
   *
   * @returns Typed budget-relevant quota state
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./synthetic-quota.ts').QuotaShapeError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const snapshot = await client.quotas({ signal, },);
   * ```
   */
  async function quotas(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<QuotaSnapshot> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: quotas.name,
      l,
    },);

    /**
     * Raw reply from the quota endpoint.
     */
    const reply = await transport({
      url: quotasUrl,
      method: 'GET',
      headers,
      signal,
    },);

    if ((reply.status < HTTP_SUCCESS_MIN) || (reply.status >= HTTP_SUCCESS_MAX_EXCLUSIVE)) {
      throw new SyntheticHttpError({
        status: reply.status,
        bodyText: reply.bodyText,
      },);
    }

    /**
     * Typed snapshot parsed from the verified body shape.
     */
    const snapshot = parseQuotaSnapshot({ bodyText: reply.bodyText, },);

    /**
     * Snapshot blocks pulled out for the log line.
     */
    const {
      fiveHour,
      weekly,
    } = snapshot;
    rl.debug(
      `five-hour ${String(fiveHour.remaining,)}/${String(fiveHour.max,)}, weekly ${
        String(weekly.percentRemaining,)
      }% remaining`,
    );
    return snapshot;
  }

  return {
    chatText,
    chatJson,
    quotas,
  };
}

//endregion Synthetic client
