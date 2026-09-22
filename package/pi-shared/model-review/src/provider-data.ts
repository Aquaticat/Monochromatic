/**
 Isolated provider request data builders.
 
 @module
 */

import {
  normalizeContext,
  type Api,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type Tool,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 Simple options carrying provider-specific forced selector.

 Pi AI 0.87 narrowed `SimpleStreamOptions.toolChoice` to provider-neutral `'auto' | 'none'`,
 so provider-specific selectors replace that field instead of intersecting with it.

 @example
 ```ts
 const options: ReviewSimpleStreamOptions = { toolChoice: 'required' };
 ```
 */
type ReviewSimpleStreamOptions = Omit<SimpleStreamOptions, 'toolChoice'> & {
  /**
   Provider-specific forced tool selector.
   */
  readonly toolChoice?: unknown;
};

/**
 Clone model data into provider-owned arrays and records.
 
 @param model - selected caller model
 
 @returns isolated model snapshot
 
 @example
 ```ts
 isolateReviewModel(model);
 ```
 */
function isolateReviewModel<const TApi extends Api,>(
  model: ForeignBorrowed<Model<TApi>>,
): Model<TApi> {
  /**
   Isolated input capability list.
   */
  const input: Model<TApi>['input'] = [];
  for (const capability of model.input)
    input.push(capability,);
  /**
   Isolated pricing tiers.
   */
  const tiers: NonNullable<Model<TApi>['cost']['tiers']> = [];
  for (const tier of model.cost
    .tiers
    ?? []) {
    tiers.push({
      input: tier.input,
      output: tier.output,
      cacheRead: tier.cacheRead,
      cacheWrite: tier.cacheWrite,
      inputTokensAbove: tier.inputTokensAbove,
    },);
  }
  return {
    id: model.id,
    name: model.name,
    api: model.api,
    provider: model.provider,
    baseUrl: model.baseUrl,
    reasoning: model.reasoning,
    ...(model.thinkingLevelMap === undefined
      ? {}
      : { thinkingLevelMap: { ...model.thinkingLevelMap, }, }),
    input,
    cost: {
      input: model.cost
        .input,
      output: model.cost
        .output,
      cacheRead: model.cost
        .cacheRead,
      cacheWrite: model.cost
        .cacheWrite,
      ...(tiers.length === 0 ? {} : { tiers, }),
    },
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    ...(model.headers === undefined ? {} : { headers: { ...model.headers, }, }),
    ...(model.compat === undefined ? {} : { compat: { ...model.compat, }, }),
  };
}

/**
 Clone one structured-review tool into provider-owned outer data.
 
 @param tool - caller-owned tool definition
 
 @returns isolated outer tool snapshot
 
 @example
 ```ts
 isolateReviewTool(tool);
 ```
 */
function isolateReviewTool(
  tool: ForeignBorrowed<Tool>,
): Tool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: { ...tool.parameters, },
    ...(tool.constrainedSampling === undefined
      ? {}
      : { constrainedSampling: tool.constrainedSampling, }),
  };
}

/**
 Clone known one-message review context into provider-owned containers.
 
 @param context - final structured-review context
 
 @returns isolated provider context
 
 @throws when context contains unsupported message content
 
 @example
 ```ts
 isolateReviewContext(context);
 ```
 */
function isolateReviewContext(
  context: ForeignBorrowed<Context>,
): TranscriptContext {
  /**
   Isolated review messages.
   */
  const messages: Context['messages'] = [];
  for (const message of context.messages) {
    if ((message.role !== 'user') || ((typeof message.content) !== 'string')) {
      throw new Error(
        `Structured review provider received unsupported ${message.role} message content`,
      );
    }
    messages.push({
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    },);
  }
  /**
   Isolated structured tools.
   */
  const tools: Tool[] = [];
  for (const tool of context.tools ?? [])
    tools.push(isolateReviewTool(tool,),);
  // Pi AI 0.87 provider modules read prompt and tools only from transcript system messages;
  // a raw Context reaching them sends neither, while forced toolChoice still names the tool.
  return normalizeContext({
    ...(context.systemPrompt === undefined
      ? {}
      : { systemPrompt: context.systemPrompt, }),
    messages,
    ...(tools.length === 0 ? {} : { tools, }),
  },);
}

/**
 Clone provider options into fresh outer records.
 
 @param options - final structured-review stream options
 
 @returns isolated provider options
 
 @example
 ```ts
 isolateReviewOptions({ signal: AbortSignal.timeout(1000) });
 ```
 */
function isolateReviewOptions(
  options: ForeignBorrowed<ReviewSimpleStreamOptions>,
): SimpleStreamOptions {
  /**
   Provider-neutral fields copied into fresh records.
   */
  const neutralOptions: SimpleStreamOptions = {
    ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey, }),
    ...(options.headers === undefined ? {} : { headers: { ...options.headers, }, }),
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens, }),
  };
  if (options.toolChoice === undefined)
    return neutralOptions;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- Pi AI 0.87 types SimpleStreamOptions.toolChoice as provider-neutral, but every provider module's streamSimple still forwards it verbatim (anthropic-messages.js, openai-responses.js, openai-completions.js, bedrock-converse-stream.js); toolChoiceForApi picks the selector each API accepts. */
  return {
    ...neutralOptions,
    toolChoice: options.toolChoice as NonNullable<SimpleStreamOptions['toolChoice']>,
  };
  /* oxlint-enable typescript/no-unsafe-type-assertion */
}

/**
 Assert model carries exact API discriminant.
 
 @param input - selected model and expected API literal
 
 @returns nothing
 
 @throws when model API differs from expected literal
 
 @example
 ```ts
 const input = { model, api: 'openai-responses' } as const;
 assertModelUsesApi(input);
 ```
 */
function assertModelUsesApi<const TApi extends Api,>(
  input: {
    readonly model: ForeignBorrowed<Model<Api>>;
    readonly api: TApi;
  },
): asserts input is {
  readonly model: ForeignBorrowed<Model<TApi>>;
  readonly api: TApi;
} {
  if (input.model
    .api
    !== input.api) {
    throw new Error(
      `Expected review model API ${input.api} but received ${input.model
        .api}`,
    );
  }
}

export {
  isolateReviewContext,
  isolateReviewModel,
  isolateReviewOptions,
  assertModelUsesApi,
};
export type { ReviewSimpleStreamOptions, };
