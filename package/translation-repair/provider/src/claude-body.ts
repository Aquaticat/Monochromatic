import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  answerToolDefinition,
  type ReadableResponseFormat,
} from './anthropic-tool.ts';
import {
  speakingTurns,
  systemTextOf,
} from './anthropic-request.ts';
import type { VisionMessage, } from './chat-contract.ts';

//region Claude body
// THE BODY ONE CLAUDE CALL SENDS. FIRST DRAFT: it takes the model id as the caller spelled it, answers a schema with
// a forced tool, sends no thinking or effort, forwards sampling knobs a request happens to carry, and marks no
// cache breakpoint. The guards follow one commit each, red first.

/**
 Builds the whole body of one Messages call.

 @param modelId - model id as the caller spelled it

 @param messages - conversation as the caller built it, system message included

 @param responseFormat - structured-output constraint, omitted for free text

 @param maxTokens - ceiling for the call

 @param request - the request as the caller built it, whose loose members the draft forwards

 @returns Body to serialise

 @example
 ```ts
 const body = buildClaudeBody({ modelId, messages, maxTokens: 1_000, request, },);
 ```
 */
export function buildClaudeBody(
  {
    modelId,
    messages,
    responseFormat,
    maxTokens,
    request,
  }: {
    readonly modelId: string;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat?: ReadableResponseFormat;
    readonly maxTokens: number;
    readonly request: Readonly<Record<string, unknown>>;
  },
): Readonly<Record<string, unknown>> {
  /**
   Answer tool, for a call that stated a schema.
   */
  const tool = (responseFormat === undefined) ? undefined : answerToolDefinition({ responseFormat, },);
  return {
    model: modelId,
    max_tokens: maxTokens,
    stream: true,
    system: systemTextOf({ messages, },),
    messages: speakingTurns({ messages, },),
    ...((tool === undefined) ? {} : { tools: [tool,], tool_choice: { type: 'tool', name: tool.name, }, }),
    ...((request['temperature'] === undefined) ? {} : { temperature: request['temperature'], }),
    ...((request['top_p'] === undefined) ? {} : { top_p: request['top_p'], }),
    ...((request['top_k'] === undefined) ? {} : { top_k: request['top_k'], }),
  };
}

//endregion Claude body
