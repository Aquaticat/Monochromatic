import type {
  ChatMessage,
  CompletionUsage,
} from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { QuotaSnapshot, } from './synthetic-quota.ts';

//region Chat contract
// Request and outcome shapes of the model-facing client. Outcomes are data:
// refusals and schema mismatches are ordinary results of calling unreliable models,
// never exceptions; only provider protocol failures throw.
// Sampling knobs are absent by design: the serving stack (upstream GPU
// providers, inference pipelines, and the models themselves) does not honor
// temperature or reasoning effort reliably (errors, degraded or truncated
// output), so every call runs on defaults. Do not add a temperature or
// effort field.

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
   * Deadline bounding the exchange itself, armed only after the
   * per-model slot is acquired, so local queue wait behind concurrent
   * same-model calls never counts against it.
   * Fan-outs need this: a dispatch-time deadline starves every queued
   * call simultaneously.
   */
  readonly exchangeTimeoutMs?: number;

  /**
   * Completion token cap when the caller bounds output.
   * Thinking tokens count against it and dominate output on these models
   * (expect 90%+), so set it generously or omit it;
   * a tight cap truncates mid-thinking and destroys the answer.
   */
  readonly maxTokens?: number;

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
   * Verbatim content of the first choice;
   * empty when the API refused and returned no content.
   */
  readonly text: string;

  /**
   * First-class refusal from the message `refusal` field.
   */
  readonly refusal?: string;

  /**
   * Token usage when the server reported it;
   * completion counts include thinking tokens.
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

    /**
     * Token usage when reported; thinking tokens included.
     */
    readonly usage?: CompletionUsage;
  }
  | {
    /**
     * The API refused outright or the answer reads as a refusal;
     * reroute cross-family.
     */
    readonly kind: 'refusal-shaped';

    /**
     * Verbatim model text for audit trails.
     */
    readonly rawText: string;

    /**
     * Refusal marker that fired;
     * `api-refusal-field` when the message `refusal` field was set.
     * Feeds the scorecard.
     */
    readonly marker: string;

    /**
     * Token usage when reported; thinking tokens included.
     */
    readonly usage?: CompletionUsage;
  }
  | {
    /**
     * Content is not valid JSON, failed the caller's guard,
     * or was truncated inside its thinking block.
     */
    readonly kind: 'schema-mismatch';

    /**
     * Verbatim model text for audit trails.
     */
    readonly rawText: string;

    /**
     * What failed: parse step, guard, or thinking truncation.
     */
    readonly detail: string;

    /**
     * Token usage when reported; thinking tokens included.
     */
    readonly usage?: CompletionUsage;
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

//endregion Chat contract
