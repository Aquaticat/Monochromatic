import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { ReadableResponseFormat, } from './anthropic-tool.ts';
import {
  speakingTurns,
  systemTextOf,
} from './anthropic-request.ts';
import type { VisionMessage, } from './chat-contract.ts';
import type { ClaudeModelInfo, } from './claude-catalog.ts';

//region Claude body
// THE BODY ONE CLAUDE CALL SENDS, member by member from the owner's brief of 2026-10-22 and the probes it cites.
// What it leaves out is as much of the contract as what it sends: no `temperature`, `top_p` or `top_k` (any
// non-default value is refused with HTTP 400 on both models, and a request has no field to carry one), no assistant
// prefill (400 as well), no forced `tool_choice`, no `budget_tokens` and no way to turn thinking off.

/**
 Refusal raised when a conversation ends on an assistant turn, which the API reads as a prefill and answers with 400
 on both models.

 A THROW RATHER THAN A DATA OUTCOME, because it is a prompt built wrong in our own code and not a thing a model did.

 @example
 ```ts
 throw new ClaudePrefillError();
 ```
 */
export class ClaudePrefillError extends Error {
  /**
   Declares this message safe to forward: it names a structural rule and quotes no message.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the failure.

   @example
   ```ts
   new ClaudePrefillError();
   ```
   */
  public constructor() {
    super(
      'The conversation ends on an assistant turn, which Sonnet 5.5 and Haiku 5.5 refuse as a prefill (HTTP 400); '
        + 'end it on a user turn',
    );
    this.name = 'ClaudePrefillError';
  }
}

/**
 Builds the whole body of one Messages call.

 @param card - the Claude card the call is for, whose wire model the body carries

 @param messages - conversation as the caller built it, system message included

 @param responseFormat - structured-output constraint, omitted for free text

 @param maxTokens - ceiling for the call

 @returns Body to serialise

 @throws {@link ClaudePrefillError} when the conversation ends on an assistant turn

 @throws {@link EmptyConversationError} where the messages cannot form a conversation

 @example
 ```ts
 const body = buildClaudeBody({ card, messages, maxTokens: 1_000, },);
 ```
 */
export function buildClaudeBody(
  {
    card,
    messages,
    responseFormat,
    maxTokens,
  }: {
    readonly card: ClaudeModelInfo;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat?: ReadableResponseFormat;
    readonly maxTokens: number;
  },
): Readonly<Record<string, unknown>> {
  /**
   Turns the conversation holds outside the system prompt.
   */
  const turns = speakingTurns({ messages, },);
  if (turns.at(-1,)?.role === 'assistant')
    throw new ClaudePrefillError();
  /**
   Every system message, joined into the one field this protocol takes.
   */
  const instruction = systemTextOf({ messages, },);
  return {
    model: card.wireModel,
    max_tokens: maxTokens,
    stream: true,
    // THINKING IS ALWAYS ADAPTIVE, AND NOTHING HERE TURNS IT OFF OR BUDGETS IT. The scoped rule, owner 2026-10-22
    // ("I'm only against thinking params on 3rd tier providers", "Anthropic counts as first rate", "we should never
    // disable thinking on anything"): thinking parameters are cleared on Anthropic, DeepSeek direct, Xiaomi direct and
    // NeuralWatt and banned on Hyper, Synthetic, OpenRouter and Bedrock. So this body sends `adaptive` and never
    // `disabled` or `between_tools` (which turns thinking off on Sonnet 5.5), and never `budget_tokens`, which both
    // models answer with HTTP 400.
    thinking: { type: 'adaptive', },
    // THE STABLE PREFIX IS THE SYSTEM FIELD. Every call of a stage opens on the same instruction (house policy, the
    // rules, the reply block) and differs in the sheet it shows, which is the user turn, so one ephemeral breakpoint
    // on the last system block caches what hundreds of calls repeat. The default time to live of five minutes stands,
    // with no `ttl` member: the brief asks for 5 minutes, priced at the 5-minute write rate on the card. A prefix under
    // 286 tokens on either model is not cached, silently, and costs nothing extra.
    ...((instruction === '')
      ? {}
      : {
        system: [{
          type: 'text',
          text: instruction,
          cache_control: { type: 'ephemeral', },
        },],
      }),
    messages: turns,
    // STRUCTURED OUTPUT BY `output_config.format`, NEVER BY A FORCED TOOL. The parent session's probe of 2026-10-22
    // (`sonnet-route-probe.out`): Sonnet 5.5 answered `output_config.format` with adaptive thinking (192 thinking
    // tokens, a right answer) and refused a forced `tool` with HTTP 400 ("tool_choice: type \"tool\" and \"any\" are
    // not supported for this model."). Haiku 5.5 under a forced `tool` or `any` returned no thinking tokens on 12 of 12
    // calls and the wrong answer on 6 of 6 hard ones, against 0 of 12 wrong with `format` or auto
    // (`haiku-forced-tool-probe*.out`). The schema goes through unchanged, as the answer object the call states.
    // `effort` is the card's, one level per effort card; a card that names none sends none, which is the model's own
    // default (Sonnet high, Haiku medium), the neutral reading of the owner's "Why don't you bench?".
    ...((responseFormat === undefined) && (card.effort === undefined)
      ? {}
      : {
        output_config: {
          ...((card.effort === undefined) ? {} : { effort: card.effort, }),
          ...((responseFormat === undefined)
            ? {}
            : {
              format: {
                type: 'json_schema',
                schema: responseFormat.json_schema.schema,
              },
            }),
        },
      }),
  };
}

//endregion Claude body
