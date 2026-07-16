/**
 * Direct Pi AI provider dispatch for structured reviewer attempts.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEventStream,
  Context,
  Model,
  ProviderStreams,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi, } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { azureOpenAIResponsesApi, } from '@earendil-works/pi-ai/api/azure-openai-responses.lazy';
import { bedrockConverseStreamApi, } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { googleGenerativeAIApi, } from '@earendil-works/pi-ai/api/google-generative-ai.lazy';
import { googleVertexApi, } from '@earendil-works/pi-ai/api/google-vertex.lazy';
import { mistralConversationsApi, } from '@earendil-works/pi-ai/api/mistral-conversations.lazy';
import { openAICodexResponsesApi, } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy';
import { openAICompletionsApi, } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi, } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Direct provider implementations supported by Pi AI.
 */
const PROVIDER_STREAMS: ReadonlyMap<string, ProviderStreams> = new Map([
  [
    'anthropic-messages',
    anthropicMessagesApi(),
  ],
  [
    'azure-openai-responses',
    azureOpenAIResponsesApi(),
  ],
  [
    'bedrock-converse-stream',
    bedrockConverseStreamApi(),
  ],
  [
    'google-generative-ai',
    googleGenerativeAIApi(),
  ],
  [
    'google-vertex',
    googleVertexApi(),
  ],
  [
    'mistral-conversations',
    mistralConversationsApi(),
  ],
  [
    'openai-codex-responses',
    openAICodexResponsesApi(),
  ],
  [
    'openai-completions',
    openAICompletionsApi(),
  ],
  [
    'openai-responses',
    openAIResponsesApi(),
  ],
],);

/**
 * Options for direct provider dispatch.
 *
 * @example
 * ```ts
 * const options: DefaultStructuredReviewStreamOptions = { model, context };
 * ```
 */
type DefaultStructuredReviewStreamOptions = {
  /**
   * Selected reviewer model.
   */
  readonly model: ForeignBorrowed<Model<Api>>;
  /**
   * Reviewer provider context.
   */
  readonly context: ForeignBorrowed<Context>;
  /**
   * Stream auth, cancellation, and tool choice.
   */
  readonly options?: ForeignBorrowed<SimpleStreamOptions>;
};

/**
 * Dispatch one stream through implementation matching selected model API.
 *
 * @param model - selected reviewer model
 *
 * @param context - reviewer provider context
 *
 * @param options - stream auth, cancellation, and tool choice
 *
 * @returns assistant event stream
 *
 * @mutates model - `streams.streamSimple` can read caller-owned model accessors and proxy traps
 *
 * @mutates context - `streams.streamSimple` can read caller-owned context accessors and proxy traps
 *
 * @mutates options - `streams.streamSimple` can invoke payload callbacks and read caller-owned hooks
 *
 * @throws when selected API has no direct implementation
 *
 * @example
 * ```ts
 * defaultStructuredReviewStream({ model, context, options });
 * ```
 */
function defaultStructuredReviewStream(
  {
    model,
    context,
    options,
  }: ForeignBorrowed<Readonly<DefaultStructuredReviewStreamOptions>>,
): AssistantMessageEventStream {
  /**
   * Provider implementation for selected API.
   */
  const streams = PROVIDER_STREAMS.get(model.api,);
  if (streams === undefined) {
    throw new Error(
      `No Pi AI API implementation available for structured reviewer ${model.provider}/${model.id} using ${model.api}`,
    );
  }
  return streams.streamSimple(
    model,
    context,
    options,
  );
}

/**
 * Stream adapter type accepted by structured review.
 *
 * @example
 * ```ts
 * const stream: StructuredReviewStream = streams.streamSimple;
 * ```
 */
type StructuredReviewStream = ProviderStreams['streamSimple'];

/**
 * Dispatch options with optional injected stream.
 *
 * @example
 * ```ts
 * const options: StructuredReviewStreamCallOptions = { model, context };
 * ```
 */
type StructuredReviewStreamCallOptions = DefaultStructuredReviewStreamOptions & {
  /**
   * Test or caller stream override.
   */
  readonly stream?: ForeignBorrowed<StructuredReviewStream>;
};

/**
 * Route reviewer streaming through injected or production adapter.
 *
 * @param stream - optional injected stream capability
 *
 * @param model - selected reviewer model
 *
 * @param context - reviewer provider context
 *
 * @param options - provider stream options
 *
 * @returns reviewer event stream
 *
 * @mutates stream - supplied stream capability can change captured state when invoked
 *
 * @mutates model - selected stream implementation can read caller-owned model hooks
 *
 * @mutates context - selected stream implementation can read caller-owned context hooks
 *
 * @mutates options - selected stream implementation can invoke callbacks and read caller-owned hooks
 *
 * @example
 * ```ts
 * streamStructuredReview({ model, context, options });
 * ```
 */
function streamStructuredReview(
  {
    stream,
    model,
    context,
    options,
  }: ForeignBorrowed<Readonly<StructuredReviewStreamCallOptions>>,
): AssistantMessageEventStream {
  if (stream !== undefined) {
    return stream(
      model,
      context,
      options,
    );
  }
  return defaultStructuredReviewStream({
    model,
    context,
    ...(options === undefined ? {} : { options, }),
  },);
}

export {
  defaultStructuredReviewStream,
  streamStructuredReview,
};
