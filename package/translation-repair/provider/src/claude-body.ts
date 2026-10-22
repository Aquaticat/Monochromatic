import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { ReadableResponseFormat, } from './anthropic-tool.ts';
import {
  speakingTurns,
  systemTextOf,
} from './anthropic-request.ts';
import type { VisionMessage, } from './chat-contract.ts';
import type { ClaudeModelInfo, } from './claude-catalog.ts';

//region Claude body
// THE BODY ONE CLAUDE CALL SENDS. FIRST DRAFT: it answers a schema with
// a forced tool, sends no thinking or effort, forwards sampling knobs a request happens to carry, and marks no
// cache breakpoint. The guards follow one commit each, red first.

/**
 Builds the whole body of one Messages call.

 @param card - the Claude card the call is for, whose wire model the body carries

 @param messages - conversation as the caller built it, system message included

 @param responseFormat - structured-output constraint, omitted for free text

 @param maxTokens - ceiling for the call

 @param request - the request as the caller built it, whose loose members the draft forwards

 @returns Body to serialise

 @example
 ```ts
 const body = buildClaudeBody({ card, messages, maxTokens: 1_000, request, },);
 ```
 */
export function buildClaudeBody(
  {
    card,
    messages,
    responseFormat,
    maxTokens,
    request,
  }: {
    readonly card: ClaudeModelInfo;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat?: ReadableResponseFormat;
    readonly maxTokens: number;
    readonly request: Readonly<Record<string, unknown>>;
  },
): Readonly<Record<string, unknown>> {
  return {
    model: card.wireModel,
    max_tokens: maxTokens,
    stream: true,
    system: systemTextOf({ messages, },),
    messages: speakingTurns({ messages, },),
    // STRUCTURED OUTPUT BY `output_config.format`, NEVER BY A FORCED TOOL. The parent session's probe of 2026-10-22
    // (`sonnet-route-probe.out`): Sonnet 5.5 answered `output_config.format` with adaptive thinking (192 thinking
    // tokens, a right answer) and refused a forced `tool` with HTTP 400 ("tool_choice: type \"tool\" and \"any\" are
    // not supported for this model."). Haiku 5.5 under a forced `tool` or `any` returned no thinking tokens on 12 of 12
    // calls and the wrong answer on 6 of 6 hard ones, against 0 of 12 wrong with `format` or auto
    // (`haiku-forced-tool-probe*.out`). The schema goes through unchanged, as the answer object the call states.
    ...((responseFormat === undefined)
      ? {}
      : {
        output_config: {
          format: {
            type: 'json_schema',
            schema: responseFormat.json_schema.schema,
          },
        },
      }),
    ...((request['temperature'] === undefined) ? {} : { temperature: request['temperature'], }),
    ...((request['top_p'] === undefined) ? {} : { top_p: request['top_p'], }),
    ...((request['top_k'] === undefined) ? {} : { top_k: request['top_k'], }),
  };
}

//endregion Claude body
