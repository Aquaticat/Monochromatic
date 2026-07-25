/**
 * Direct Pi AI provider dispatch for structured reviewer requests.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEvent,
  Context,
  Model,
} from '@earendil-works/pi-ai';
import { streamSimple as streamAnthropicMessages, } from '@earendil-works/pi-ai/api/anthropic-messages';
import { streamSimple as streamAzureOpenAIResponses, } from '@earendil-works/pi-ai/api/azure-openai-responses';
import { streamSimple as streamBedrockConverse, } from '@earendil-works/pi-ai/api/bedrock-converse-stream';
import { streamSimple as streamGoogleGenerativeAI, } from '@earendil-works/pi-ai/api/google-generative-ai';
import { streamSimple as streamGoogleVertex, } from '@earendil-works/pi-ai/api/google-vertex';
import { streamSimple as streamMistralConversations, } from '@earendil-works/pi-ai/api/mistral-conversations';
import { streamSimple as streamOpenAICodexResponses, } from '@earendil-works/pi-ai/api/openai-codex-responses';
import { streamSimple as streamOpenAICompletions, } from '@earendil-works/pi-ai/api/openai-completions';
import { streamSimple as streamOpenAIResponses, } from '@earendil-works/pi-ai/api/openai-responses';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  isolateReviewContext,
  isolateReviewModel,
  isolateReviewOptions,
  modelUsesApi,
  type ReviewSimpleStreamOptions,
} from './provider-data.ts';
import type {
  ScriptedStructuredReviewTransport,
  StructuredReviewMessageSnapshot,
  StructuredReviewRequestSnapshot,
} from './types.ts';

/**
 * Provider dispatch inputs.
 *
 * @example
 * ```ts
 * const request: StructuredReviewStreamRequest = { model, context, options };
 * ```
 */
type StructuredReviewStreamRequest = {
  /** Selected reviewer model. */
  readonly model: ForeignBorrowed<Model<Api>>;
  /** Final provider context. */
  readonly context: ForeignBorrowed<Context>;
  /** Final provider stream options. */
  readonly options: ForeignBorrowed<ReviewSimpleStreamOptions>;
  /** Optional deterministic data seam. */
  readonly testTransport?: ForeignBorrowed<ScriptedStructuredReviewTransport>;
};

/**
 * Project provider APIs supported by Pi AI direct modules.
 */
const SUPPORTED_APIS = 'anthropic-messages, azure-openai-responses, bedrock-converse-stream, google-generative-ai, google-vertex, mistral-conversations, openai-codex-responses, openai-completions, openai-responses';

/**
 * Snapshot one known review context without retaining caller-owned arrays.
 *
 * @param context - final provider context
 *
 * @returns isolated primitive request projection
 *
 * @example
 * ```ts
 * snapshotContext(context);
 * ```
 */
function snapshotContext(
  context: ForeignBorrowed<Context>,
): StructuredReviewRequestSnapshot['context'] {
  /** Isolated user-message snapshots. */
  const messages: StructuredReviewMessageSnapshot[] = [];
  for (const message of context.messages) {
    if ((message.role !== 'user') || ((typeof message.content) !== 'string')) {
      throw new Error(
        `Structured review request snapshot received unsupported ${message.role} message content`,
      );
    }
    messages.push({
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    },);
  }
  /** Isolated tool-name snapshots. */
  const toolNames: string[] = [];
  for (const tool of context.tools ?? [])
    toolNames.push(tool.name,);
  return {
    systemPrompt: context.systemPrompt ?? '',
    messages,
    toolNames,
  };
}

/**
 * Snapshot stream options without retaining header or selector objects.
 *
 * @param options - final provider stream options
 *
 * @returns isolated primitive options projection
 *
 * @example
 * ```ts
 * snapshotOptions({ signal: AbortSignal.timeout(1000) });
 * ```
 */
function snapshotOptions(
  options: ForeignBorrowed<ReviewSimpleStreamOptions>,
): StructuredReviewRequestSnapshot['options'] {
  /** Provider-specific tool selector. */
  const { toolChoice, } = options;
  /** Primitive selector type when present. */
  const toolChoiceType = (typeof toolChoice) === 'string'
    ? toolChoice
    : ((toolChoice !== null)
      && ((typeof toolChoice) === 'object')
      && ('type' in toolChoice)
      && ((typeof toolChoice.type) === 'string'))
      ? toolChoice.type
      : undefined;
  /** Primitive selector tool name when present. */
  const toolChoiceName = ((toolChoice !== null)
    && ((typeof toolChoice) === 'object')
    && ('name' in toolChoice)
    && ((typeof toolChoice.name) === 'string'))
    ? toolChoice.name
    : undefined;
  return {
    ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey, }),
    ...(options.headers === undefined
      ? {}
      : { headers: { ...options.headers, }, }),
    hasSignal: options.signal !== undefined,
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens, }),
    ...(toolChoiceType === undefined ? {} : { toolChoiceType, }),
    ...(toolChoiceName === undefined ? {} : { toolChoiceName, }),
  };
}

/**
 * Consume one scripted response after recording exact provider request data.
 *
 * @param transport - mutable deterministic script state
 *
 * @param model - selected reviewer model
 *
 * @param context - final provider context
 *
 * @param options - final provider options
 *
 * @returns next scripted response stream
 *
 * @mutates transport - advances script and records isolated request snapshot
 *
 * @example
 * ```ts
 * scriptedStructuredReviewStream({ transport, model, context, options });
 * ```
 */
function scriptedStructuredReviewStream(
  {
    transport,
    model,
    context,
    options,
  }: {
    transport: ScriptedStructuredReviewTransport;
    readonly model: ForeignBorrowed<Model<Api>>;
    readonly context: ForeignBorrowed<Context>;
    readonly options: ForeignBorrowed<ReviewSimpleStreamOptions>;
  },
): AsyncIterable<AssistantMessageEvent> {
  /** Script index consumed by this request. */
  const index = transport.nextResponseIndex;
  /** Scripted response selected before state advances. */
  const response = transport.responses[index];
  if (response === undefined)
    throw new Error(`Scripted structured review has no response at index ${index}`,);
  transport.requests[index] = {
    model: {
      api: model.api,
      id: model.id,
      provider: model.provider,
    },
    context: snapshotContext(context,),
    options: snapshotOptions(options,),
  };
  transport.nextResponseIndex = index + 1;
  return response;
}

/**
 * Dispatch one stream through concrete implementation matching selected API.
 *
 * Static concrete imports expose exact shipped runtime exports to package
 * implementation analysis without callback or retained-provider indirection.
 *
 * @param model - selected reviewer model
 *
 * @param context - final provider context
 *
 * @param options - final provider stream options
 *
 * @param testTransport - optional deterministic data seam
 *
 * @returns assistant event stream
 *
 * @mutates model - concrete provider can inspect selected model data
 *
 * @mutates context - concrete provider consumes request messages and tools
 *
 * @mutates options - concrete provider observes auth and cancellation capabilities
 *
 * @mutates testTransport - deterministic seam advances script and records snapshot
 *
 * @throws when selected API has no direct implementation
 *
 * @example
 * ```ts
 * await streamStructuredReview({ model, context, options });
 * ```
 */
async function streamStructuredReview(
  {
    model,
    context,
    options,
    testTransport,
  }: ForeignBorrowed<Readonly<StructuredReviewStreamRequest>>,
): Promise<AsyncIterable<AssistantMessageEvent>> {
  if (testTransport !== undefined) {
    return scriptedStructuredReviewStream({
      transport: testTransport,
      model,
      context,
      options,
    },);
  }
  /** Isolated provider context used only beyond external package boundary. */
  const providerContext = isolateReviewContext(context,);
  /** Isolated provider options used only beyond external package boundary. */
  const providerOptions = isolateReviewOptions(options,);
  if (modelUsesApi({ model, api: 'anthropic-messages', },)) {
    return streamAnthropicMessages(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'azure-openai-responses', },)) {
    return streamAzureOpenAIResponses(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'bedrock-converse-stream', },)) {
    return streamBedrockConverse(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'google-generative-ai', },)) {
    return streamGoogleGenerativeAI(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'google-vertex', },)) {
    return streamGoogleVertex(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'mistral-conversations', },)) {
    return streamMistralConversations(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'openai-codex-responses', },)) {
    return streamOpenAICodexResponses(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'openai-completions', },)) {
    return streamOpenAICompletions(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  if (modelUsesApi({ model, api: 'openai-responses', },)) {
    return streamOpenAIResponses(
      isolateReviewModel(model,),
      providerContext,
      providerOptions,
    );
  }
  throw new Error(
    `No Pi AI API implementation available for structured reviewer ${model.provider}/${model.id} using ${model.api}. Supported APIs: ${SUPPORTED_APIS}`,
  );
}

export { streamStructuredReview, };
