/**
 * Tests for the Messages API request body.
 *
 * THE CEILING CASES PIN AN OWNER DECISION, not a preference: `max_tokens` is
 * the lower of `#156`'s measured answer bound and the model's own cap, and a
 * caller's own ceiling may lower it further but never raise it. A body that
 * asked for more than the model can emit would be answered with a truncation
 * the pipeline reads as a schema mismatch, which costs a call and blames a
 * model.
 *
 * THE ALTERNATION CASES PIN A PROTOCOL DIFFERENCE. The OpenAI-compatible
 * provider takes the system prompt as a message and does not care what follows
 * it. This one takes the system prompt as a field and requires the conversation
 * to open on a user turn, so the same message array has to be rearranged rather
 * than forwarded.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildAnthropicBody,
  EmptyConversationError,
  speakingTurns,
  systemTextOf,
} from '../dist/final/node/index.mjs';

/**
 * Structured-output constraint standing in for a real stage's.
 */
const catFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'whisker_report',
    schema: {
      type: 'object',
      required: ['verdict',],
      properties: { verdict: { type: 'string', }, },
    },
  },
} as const;

/**
 * Shortest conversation a stage sends: one instruction and one question.
 */
const catMessages = [
  {
    role: 'system',
    content: 'You count the toebeans of one cat.',
  },
  {
    role: 'user',
    content: 'How many on the front left?',
  },
] as const;

await describe({
  name: systemTextOf.name,
  children: [
    it({
      name: 'LIFTS the system message out, since this protocol takes it as a field rather than '
        + 'as the first message',
      fn: async () => {
        expect(systemTextOf({ messages: catMessages, },),).toBe('You count the toebeans of one cat.',);
      },
    },),

    it({
      name: 'JOINS several system messages rather than keeping only one, because dropping any of '
        + 'them would silently change what a stage asked',
      fn: async () => {
        expect(systemTextOf({
          messages: [
            {
              role: 'system',
              content: 'First rule.',
            },
            {
              role: 'user',
              content: 'Question.',
            },
            {
              role: 'system',
              content: 'Second rule.',
            },
          ],
        },),).toBe('First rule.\n\nSecond rule.',);
      },
    },),

    it({
      name: 'ANSWERS with empty text where no system message was sent, rather than inventing one',
      fn: async () => {
        expect(systemTextOf({
          messages: [
            {
              role: 'user',
              content: 'Question.',
            },
          ],
        },),).toBe('',);
      },
    },),

    it({
      name: 'REFUSES a system message carrying pictures, which this protocol has no field for',
      fn: async () => {
        expect(() => {
          systemTextOf({
            messages: [
              {
                role: 'system',
                content: [
                  {
                    type: 'text',
                    text: 'Rule.',
                  },
                ],
              },
            ],
          },);
        },).toThrow(EmptyConversationError,);
      },
    },),
  ],
},);

await describe({
  name: speakingTurns.name,
  children: [
    it({
      name: 'DROPS the system turn and keeps the rest in order, which is the whole rearrangement '
        + 'this protocol needs',
      fn: async () => {
        expect(speakingTurns({ messages: catMessages, },),).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'How many on the front left?',
              },
            ],
          },
        ],);
      },
    },),

    it({
      name: 'KEEPS a repair conversation alternating, which is the shape #88 sends: the question, '
        + 'the answer that failed, and the correction',
      fn: async () => {
        expect(speakingTurns({
          messages: [
            {
              role: 'system',
              content: 'Rules.',
            },
            {
              role: 'user',
              content: 'Translate.',
            },
            {
              role: 'assistant',
              content: '{"translation":"…"}',
            },
            {
              role: 'user',
              content: 'Findings.',
            },
          ],
        },).map(function named(turn,): string {
          return turn.role;
        },),).toEqual(['user', 'assistant', 'user',],);
      },
    },),

    it({
      name: 'MERGES consecutive same-role turns rather than refusing them, because the other '
        + 'provider accepts them and a call routed either way must ask the same question',
      fn: async () => {
        /**
         * Two user turns in a row, as only a merge can express here.
         */
        const turns = speakingTurns({
          messages: [
            {
              role: 'user',
              content: 'First half.',
            },
            {
              role: 'user',
              content: 'Second half.',
            },
          ],
        },);

        expect(turns,).toEqual([
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'First half.',
              },
              {
                type: 'text',
                text: 'Second half.',
              },
            ],
          },
        ],);
      },
    },),

    it({
      name: 'REFUSES a conversation that is only a system prompt, which this protocol rejects and '
        + 'which would otherwise cost a call to find out',
      fn: async () => {
        expect(() => {
          speakingTurns({
            messages: [
              {
                role: 'system',
                content: 'Rules.',
              },
            ],
          },);
        },).toThrow(EmptyConversationError,);
      },
    },),

    it({
      name: 'REFUSES a conversation opening on an assistant turn, which this protocol requires to '
        + 'be a user turn',
      fn: async () => {
        expect(() => {
          speakingTurns({
            messages: [
              {
                role: 'system',
                content: 'Rules.',
              },
              {
                role: 'assistant',
                content: 'Unprompted.',
              },
            ],
          },);
        },).toThrow(EmptyConversationError,);
      },
    },),
  ],
},);

await describe({
  name: buildAnthropicBody.name,
  children: [
    it({
      name: 'STREAMS ALWAYS, because the owner requires it and every runaway guard #118 through '
        + '#158 reads a live stream',
      fn: async () => {
        expect(buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
        },).stream,).toBe(true,);
      },
    },),

    it({
      name: 'ASKS FOR THE PER-MODEL CEILING where the caller named none, which is the lower of '
        + "#156's measured bound and the model's own cap",
      fn: async () => {
        expect(buildAnthropicBody({
          modelId: 'gpt-oss-120b',
          messages: catMessages,
        },).max_tokens,).toBe(13_107,);

        expect(buildAnthropicBody({
          modelId: 'minimax-m3',
          messages: catMessages,
        },).max_tokens,).toBe(32_000,);
      },
    },),

    it({
      name: "LOWERS the ask to the caller's ceiling, and never raises it above the model's, so a "
        + 'caller cannot ask for a length the model would truncate',
      fn: async () => {
        expect(buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
          maxTokens: 900,
        },).max_tokens,).toBe(900,);

        expect(buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
          maxTokens: 900_000,
        },).max_tokens,).toBe(16_000,);
      },
    },),

    it({
      name: 'CARRIES the instruction as the system field and the question as the only turn',
      fn: async () => {
        /**
         * Body as it would be serialised.
         */
        const body = buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
        },);

        expect(body.system,).toBe('You count the toebeans of one cat.',);
        expect(body.messages.length,).toBe(1,);
        expect(body.model,).toBe('kimi-k3',);
      },
    },),

    it({
      name: 'OFFERS NO TOOL where the caller stated no schema, and leaves the system field as the '
        + 'bare instruction, since there is no answer protocol to state',
      fn: async () => {
        /**
         * Body as it would be serialised.
         */
        const body = buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
        },);

        expect(body.tools,).toBe(undefined,);
        expect(body.tool_choice,).toBe(undefined,);
        expect(body.system.includes('HOW TO ANSWER',),).toBe(false,);
      },
    },),

    it({
      name: 'OFFERS the answer tool and states its whole schema in the system field, which is the '
        + "owner's instruction for models that emit the wrong call format",
      fn: async () => {
        /**
         * Body as it would be serialised.
         */
        const body = buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
          responseFormat: catFormat,
        },);

        /**
         * Answer tool the body offers, of which there is exactly one.
         */
        const [tool,] = body.tools ?? [];

        expect(body.tools?.length,).toBe(1,);
        expect(tool?.input_schema,).toEqual(catFormat.json_schema.schema,);
        expect(body.system.includes('You count the toebeans of one cat.',),).toBe(true,);
        expect(body.system.includes('HOW TO ANSWER',),).toBe(true,);
        expect(body.system.includes('verdict',),).toBe(true,);
      },
    },),

    it({
      name: 'FORCES the tool by the same name it offers, so the choice cannot name a tool that '
        + 'was never defined',
      fn: async () => {
        /**
         * Body as it would be serialised.
         */
        const body = buildAnthropicBody({
          modelId: 'kimi-k3',
          messages: catMessages,
          responseFormat: catFormat,
        },);

        expect(body.tool_choice,).toEqual({
          type: 'tool',
          name: 'whisker_report',
        },);
        expect(body.tools?.at(0,)?.name,).toBe('whisker_report',);
      },
    },),

    it({
      name: 'FORWARDS the conversation refusal rather than sending a body this protocol rejects',
      fn: async () => {
        expect(() => {
          buildAnthropicBody({
            modelId: 'kimi-k3',
            messages: [
              {
                role: 'system',
                content: 'Rules.',
              },
            ],
          },);
        },).toThrow(EmptyConversationError,);
      },
    },),
  ],
},);
