// PROTOTYPE ONLY: Hyper client for vetting live model ids before roster adoption.

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  answerToolDefinition,
  renderToolSystemPrompt,
} from './anthropic-tool.ts';
import {
  speakingTurns,
  systemTextOf,
} from './anthropic-request.ts';
import { extractAnthropicCompletion, } from './anthropic-completion.ts';
import { armCallDeadline, } from './call-deadline.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import type {
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  SyntheticClient,
} from './chat-contract.ts';
import {
  HYPER_API_VERSION,
  HYPER_AUTH_HEADER,
  HYPER_MESSAGES_URL,
} from './hyper-catalog.ts';
import type { RosterModelId, } from './roster-id.ts';
import type { QuotaSnapshot, } from './synthetic-quota.ts';
import {
  fetchTransport,
  type ModelTransport,
} from './synthetic-transport.ts';

export type { TransportExchange, } from './synthetic-transport.ts';

/**
 * Default bounded evaluation deadline.
 */
const EVALUATION_TIMEOUT_MS = 360_000;

/**
 * Inclusive successful HTTP status floor.
 */
const HTTP_SUCCESS_MIN = 200;

/**
 * Exclusive successful HTTP status ceiling.
 */
const HTTP_SUCCESS_MAX = 300;

//region Evaluation model contract

/**
 * Live Hyper row admitted to pre-adoption validation.
 *
 * @example
 * ```ts
 * const model = { id: 'qwen3.7-plus', requestOutputTokens: 32_000 };
 * ```
 */
export type HyperExpansionModel = {
  /**
   * Exact provider model id.
   */
  readonly id: string;

  /**
   * Canonical roster identity when provider spelling differs.
   */
  readonly requestId?: RosterModelId;

  /**
   * Output ceiling bound into evaluation manifest.
   */
  readonly requestOutputTokens: number;
};

/**
 * Provider failure carrying status only,
 * never restricted response body.
 *
 * @example
 * ```ts
 * throw new HyperExpansionHttpError({ modelId: 'qwen3.7-plus', status: 400 });
 * ```
 */
export class HyperExpansionHttpError extends Error {
  /**
   * Message is safe because it contains model id and status only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Creates privacy-safe provider error.
   *
   * @param modelId - provider model id
   *
   * @param status - HTTP response status
   */
  public constructor(
    {
      modelId,
      status,
    }: {
      readonly modelId: string;
      readonly status: number
    },
  ) {
    super(`Hyper expansion model ${modelId} returned HTTP ${String(status,)}`,);
    this.name = 'HyperExpansionHttpError';
  }
}

/**
 * Returns configured model row for runtime request id.
 *
 * @param models - configured evaluation models
 *
 * @param modelId - runtime id carried through roster-typed prototype seam
 *
 * @returns Matching configured row
 *
 * @throws {@link Error} when request names undeclared model
 */
function modelFor(
  {
    models,
    modelId,
  }: {
    readonly models: Readonly<Record<string, HyperExpansionModel>>;
    readonly modelId: string;
  },
): HyperExpansionModel {
  /**
   * Configured route row for canonical request identity.
   */
  const model = models[modelId];
  if (model === undefined)
    throw new Error(`undeclared Hyper expansion model ${modelId}`);
  return model;
}

/**
 * Assembles Anthropic Messages body without adding model to production catalog.
 *
 * @param request - provider-neutral request
 *
 * @param model - pre-adoption live model row
 *
 * @returns Hyper request body
 */
function evaluationBody(
  {
    request,
    model,
  }: {
    readonly request: ChatTextRequest;
    readonly model: HyperExpansionModel;
  },
): Record<string, unknown> {
  /**
   * Canonical system instruction lifted from provider-neutral messages.
   */
  const instruction = systemTextOf({ messages: request.messages, });
  /**
   * Request ceiling bounded by manifest route.
   */
  const maxTokens = Math.min(
    model.requestOutputTokens,
    request.maxTokens ?? model.requestOutputTokens,
  );
  if (request.responseFormat === undefined) {
    return {
      model: model.id,
      max_tokens: maxTokens,
      stream: true,
      system: instruction,
      messages: speakingTurns({ messages: request.messages, }),
    };
  }
  /**
   * Forced answer tool derived from caller schema.
   */
  const tool = answerToolDefinition({ responseFormat: request.responseFormat, });
  return {
    model: model.id,
    max_tokens: maxTokens,
    stream: true,
    system: renderToolSystemPrompt({
      instruction,
      responseFormat: request.responseFormat,
    },),
    messages: speakingTurns({ messages: request.messages, }),
    tools: [tool,],
    tool_choice: {
      type: 'tool',
      name: tool.name,
    },
  };
}

//endregion Evaluation model contract

//region Client

/**
 * Unsupported quota operation required by provider-neutral client interface.
 *
 * @returns Never resolves because expansion route has no quota endpoint
 */
async function unsupportedQuotas(): Promise<QuotaSnapshot> {
  await Promise.resolve();
  throw new Error('Hyper expansion evaluation client has no Synthetic quota endpoint');
}

/**
 * Creates zero-retry Hyper client for out-of-roster model evaluation.
 *
 * This boundary exists only because production client correctly refuses unadopted ids.
 * It preserves same Anthropic request builder components,
 * stream transport,
 * completion extractor,
 * and caller guard while making no production catalog mutation.
 *
 * @param apiKey - existing Hyper credential
 *
 * @param models - finite manifest-bound model rows
 *
 * @param transport - inspected transport seam,
 * injectable for controls
 *
 * @returns Client compatible with prototype node runtimes
 *
 * @example
 * ```ts
 * const client = createHyperExpansionClient({ apiKey: 'test', models: [{ id: 'model', requestOutputTokens: 1 }] });
 * ```
 */
export function createHyperExpansionClient(
  {
    apiKey,
    models,
    transport = fetchTransport,
  }: {
    readonly apiKey: string;
    readonly models: readonly HyperExpansionModel[];
    readonly transport?: ModelTransport;
  },
): SyntheticClient {
  /**
   * Route rows indexed by canonical request identity.
   */
  const modelById: Readonly<Record<string, HyperExpansionModel>> = Object.fromEntries(
    models.map(function row(model,) {
      return [
        model.requestId ?? model.id,
        model,
      ];
    },),
  );
  /**
   * Fixed Hyper Anthropic request headers.
   */
  const headers: Readonly<Record<string, string>> = {
    [HYPER_AUTH_HEADER]: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'anthropic-version': HYPER_API_VERSION,
  };

  /**
   * Performs one provider exchange with no retry.
   *
   * @param request - model request
   *
   * @returns Extracted provider reply
   */
  async function chatText(
    request: ForeignBorrowed<ChatTextRequest>,
  ): Promise<ChatTextReply> {
    /**
     * Manifest-bound provider route.
     */
    const model = modelFor({
      models: modelById,
      modelId: request.modelId,
    });
    /**
     * Joined per-call deadline.
     */
    using deadline = armCallDeadline({
      signal: request.signal,
      timeoutMs: request.exchangeTimeoutMs ?? EVALUATION_TIMEOUT_MS,
      label: model.id,
    },);
    /**
     * Complete provider response stream.
     */
    const reply = await transport({
      url: HYPER_MESSAGES_URL,
      label: model.id,
      method: 'POST',
      headers,
      bodyJson: JSON.stringify(evaluationBody({
        request,
        model,
      }),),
      signal: deadline.callSignal,
      wireFormat: 'anthropic',
      ...(request.maxAnswerChars === undefined
        ? {}
        : { maxAnswerChars: request.maxAnswerChars, }),
    },);
    if ((reply.status < HTTP_SUCCESS_MIN) || (reply.status >= HTTP_SUCCESS_MAX))
      throw new HyperExpansionHttpError({
        modelId: model.id,
        status: reply.status,
      });
    return extractAnthropicCompletion({ bodyText: reply.bodyText, });
  }

  return {
    chatText,
    chatJson: async function chatJson<ValueT,>(
      request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
    ) {
      return readJsonOutcome({
        modelId: request.modelId,
        reply: await chatText(request,),
        validate: request.validate,
      },);
    },
    quotas: unsupportedQuotas,
  };
}

//endregion Client
