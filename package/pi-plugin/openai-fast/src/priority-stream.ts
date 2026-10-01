/**
 Priority entry points delegate transport and accounting to native Codex streaming. @module
 */
import type {
  Api,
  AssistantMessageEventStream,
  Model,
  SimpleStreamOptions,
  StreamFunction,
  StreamOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import {
  type OpenAICodexResponsesOptions,
  stream as streamCodex,
} from '@earendil-works/pi-ai/api/openai-codex-responses';
import { buildBaseOptions, } from '@earendil-works/pi-ai/api/simple-options';
import { clampThinkingLevel, } from '@earendil-works/pi-ai/models';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { PriorityRequestError, } from './priority-error.ts';
import { forcePriorityPayload, } from './priority-payload.ts';

//region Full stream: preserve native options and live model identity.

/**
 Module logger never receives payloads, options, or credentials.
 */
const l = tagged({ tag: 'openai-fast/priority-stream', },);

/**
 Delegate full native Codex options with priority in both the options and final request body.
 Model must be the live base Codex model, not a virtual routing model.

 @param model - original base model used by native request building and accounting

 @param context - normalized transcript supplied by native provider dispatch

 @param options - complete native options; only tier and payload composition are overridden

 @param stream - full native-compatible dispatch, optionally through the original model registry

 @returns native Codex event stream without an alternate transport or model fallback

 @mutates model - native stream and caller callbacks may inspect or retain live model data

 @mutates context - native stream consumes transcript data and its reachable foreign values

 @mutates options - native stream consumes transport, cancellation, and caller callback capabilities

 @mutates stream - dispatch may invoke or retain native transport and runtime authentication capabilities

 @example
 ```ts
 const events = streamPriority({ model: baseModel, context, options });
 ```
 */
export function streamPriority({
  model,
  context,
  options,
  stream = streamCodex,
}: {
  readonly model: ForeignHostCapability<Model<'openai-codex-responses'>>;
  readonly context: ForeignHostCapability<TranscriptContext>;
  readonly options?: ForeignHostCapability<StreamOptions | OpenAICodexResponsesOptions>;
  readonly stream?: ForeignHostCapability<StreamFunction<'openai-codex-responses', OpenAICodexResponsesOptions>>;
},): AssistantMessageEventStream {
  /**
   Function logger records delegation without sensitive request data.
   */
  const innerL = tagged({ tag: streamPriority.name, l, },);
  innerL.debug('delegating priority request to native Codex stream',);
  /**
   Capture caller customization when options are composed, before registry dispatch can defer it.
   */
  const onPayload = options?.onPayload;
  return stream(model, context, {
    ...options,
    serviceTier: 'priority',
    /**
     Native callback signature retains native model and payload identity for caller customization.

     @param payload - native request being customized

     @param requestModel - exact live model supplied by native streaming

     @returns customized record with priority enforced

     @mutates payload - caller payload callback may mutate or retain request data

     @mutates requestModel - caller payload callback may inspect or retain model data
     */
    onPayload: async function priorityPayload(
      payload: unknown,
      requestModel: ForeignHostCapability<Model<Api>>,
    ): Promise<Readonly<Record<string, unknown>> & { readonly service_tier: 'priority'; }> {
      /**
       Callback logger extends the stream function boundary.
       */
      const callbackL = tagged({ tag: priorityPayload.name, l: innerL, },);
      callbackL.debug('composing priority payload callback',);
      return await forcePriorityPayload({
        payload,
        model: requestModel,
        onPayload,
      },);
    },
  },);
}

//endregion Full stream

//region Simple stream: mirror native reasoning conversion before full delegation.

/**
 Use native simple-option preparation and reasoning clamping, then delegate to the full priority stream.
 Converting through native streamSimple would discard the priority accounting option.

 @param model - original base Codex model carrying current reasoning capabilities

 @param context - normalized native transcript

 @param options - provider-neutral options preserved through native buildBaseOptions

 @param stream - full native-compatible dispatch, optionally through the original model registry

 @returns native Codex event stream with priority request and accounting intent

 @mutates model - native option preparation and streaming may inspect or retain model data

 @mutates context - native option preparation and streaming consume transcript data

 @mutates options - native preparation and streaming consume transport and callback capabilities

 @mutates stream - full dispatch may invoke or retain transport and runtime authentication capabilities

 @throws {@link PriorityRequestError} when direct native dispatch has no resolved API key

 @example
 ```ts
 const events = streamSimplePriority({ model: baseModel, context, options });
 ```
 */
export function streamSimplePriority({
  model,
  context,
  options,
  stream,
}: {
  readonly model: ForeignHostCapability<Model<'openai-codex-responses'>>;
  readonly context: ForeignHostCapability<TranscriptContext>;
  readonly options?: ForeignHostCapability<SimpleStreamOptions>;
  readonly stream?: ForeignHostCapability<StreamFunction<'openai-codex-responses', OpenAICodexResponsesOptions>>;
},): AssistantMessageEventStream {
  /**
   Function logger records conversion without exposing authentication data.
   */
  const innerL = tagged({ tag: streamSimplePriority.name, l, },);
  innerL.debug('preparing native simple Codex options',);
  /**
   Direct native dispatch requires a token; injected registry dispatch resolves it later.
   */
  const apiKey = options?.apiKey;
  if ((stream === undefined) && ((apiKey === undefined) || (apiKey === ''))) {
    innerL.error('resolved Codex API key is missing',);
    throw new PriorityRequestError({ message: `No API key for provider: ${model.provider}`, },);
  }
  /**
   Match native clamping, including conversion of unsupported reasoning to off.
   */
  const clampedReasoning = options?.reasoning ? clampThinkingLevel(model, options.reasoning,) : undefined;
  /**
   Native off semantics omit reasoningEffort rather than sending the string off.
   */
  const reasoningEffort = clampedReasoning === 'off' ? undefined : clampedReasoning;
  innerL.debug(reasoningEffort === undefined ? 'delegating without explicit reasoning effort' : 'delegating with native clamped reasoning effort',);
  return streamPriority({
    model,
    context,
    ...(stream === undefined ? {} : { stream, }),
    options: {
      ...buildBaseOptions(model, context, options, apiKey,),
      ...(options?.toolChoice === undefined ? {} : { toolChoice: options.toolChoice, }),
      ...(reasoningEffort === undefined ? {} : { reasoningEffort, }),
      serviceTier: 'priority',
    },
  },);
}

//endregion Simple stream
