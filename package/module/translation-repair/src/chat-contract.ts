import type {
  ChatMessage,
  CompletionUsage,
  ContentPart,
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
 * One message carrying parts rather than a plain string.
 *
 * FOR IMAGES, and only images so far. `#111` sends a picture so a transcribed
 * passage has a source that can be CHECKED rather than only preserved, and the
 * provider takes that as an OpenAI-compatible content-part array. The part type
 * is the shared one from `@monochromatic-dev/module-llm-type`, so nothing here
 * invents a protocol.
 *
 * @example
 * ```ts
 * const message: VisionMessage = {
 *   role: 'user',
 *   content: [
 *     { type: 'text', text: 'Read this picture.', },
 *     { type: 'image_url', image_url: { url: dataUri, }, },
 *   ],
 * };
 * ```
 */
export type VisionMessage = {
  /**
   * Author of the message, the same roles a text message uses.
   */
  readonly role: ChatMessage['role'];

  /**
   * Parts this message is composed of, in the order the model reads them.
   */
  readonly content: readonly ContentPart[];
};

/**
 * Text of a message, whichever shape it carries.
 *
 * ONE READER RATHER THAN A CAST AT EVERY SITE. Widening `content` to carry
 * picture parts left several readers expecting a string, and a cast at each of
 * them would be five places to get wrong rather than one. A picture is not
 * recoverable as text and is named by its part type instead, which is what a
 * witness or a test assertion wants: what the model was ASKED, not the bytes it
 * was shown.
 *
 * @param message - message to read
 *
 * @returns Its text, with any non-text part named
 *
 * @example
 * ```ts
 * const asked = messageText({ message, },);
 * ```
 */
export function messageText({ message, }: { readonly message: ChatMessage | VisionMessage; },): string {
  /**
   * Content as the message carries it.
   */
  const { content, } = message;
  if ((typeof content) === 'string')
    return content;

  /**
   * Text of each part, with a picture named rather than rendered.
   */
  const parts = content.map(function partText(part,): string {
    return (part.type === 'text') ? part.text : `[${part.type}]`;
  },);
  return parts.join('\n',);
}

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
   *
   * TEXT OR VISION, in one field rather than in two request shapes. The body is
   * a pass-through, `messages: request.messages` inside a `JSON.stringify`, and
   * the provider is OpenAI-compatible, so a message whose content is an array of
   * parts serialises correctly with no other change. Widening the union leaves
   * every existing caller valid, where a second request type and a second client
   * method would have duplicated the limiter, the deadline, the retry ladder and
   * the drain for one field's sake.
   */
  readonly messages: readonly (ChatMessage | VisionMessage)[];

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

  /**
   * Why the model stopped, verbatim from the provider, when it said.
   *
   * CARRIED SO A CALLER CAN TELL A CUT-OFF REPLY FROM A MALFORMED ONE. Those
   * arrive identically, as content that will not parse, and they need opposite
   * remediation: one points at the token ceiling, the other at the prompt and
   * the guard.
   */
  readonly finishReason?: string;
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
