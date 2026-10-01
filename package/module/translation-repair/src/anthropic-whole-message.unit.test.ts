/**
 Tests for the check that an Anthropic Messages body ended whole.
 
 THE CASES THAT DECIDE IT are the ones a word search passed (ledger B87): a
 body cut inside its terminator frame, and one holding the terminator's name
 only as a value. The retry ladder asks this check before it returns, so a
 body it calls whole is never retried.
 
 Fixtures are cat-themed invention. No corpus content appears here.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  MalformedCompletionError,
  requireWholeAnthropicMessage,
} from '../dist/final/node/index.mjs';

/**
 Builds one event line as the wire sends it.
 
 @param body - frame payload, which carries its own `type`
 
 @returns Frame, followed by the blank line that ends an event
 
 @example
 ```ts
 const raw = frameOf({ body: { type: 'message_stop', }, },);
 ```
 */
function frameOf(
  { body, }: { readonly body: Readonly<Record<string, unknown>>; },
): string {
  return `data: ${JSON.stringify(body,)}\n\n`;
}

/**
 Opening of a message, a keep-alive and one answer fragment, with no ending.
 */
const OPENING = frameOf({
  body: {
    type: 'message_start',
    message: {
      id: 'msg_tabby',
      role: 'assistant',
    },
  },
},)
  + frameOf({ body: { type: 'ping', }, },)
  + frameOf({
    body: {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: 'Biscuit is smug.',
      },
    },
  },);

/**
 The frame a whole message ends with.
 */
const TERMINATOR_FRAME = frameOf({ body: { type: 'message_stop', }, },);

/**
 Reads the refusal a body raises, or empty when it raises none.
 
 @param bodyText - drained body under test
 
 @returns Refusal text, empty when the body was taken as whole
 
 @example
 ```ts
 const refusal = refusalOf({ bodyText: OPENING, },);
 ```
 */
function refusalOf({ bodyText, }: { readonly bodyText: string; },): string {
  try {
    requireWholeAnthropicMessage({ bodyText, },);
    return '';
  } catch (refusal) {
    expect(refusal instanceof MalformedCompletionError,).toBe(true,);
    return String(refusal,);
  }
}

await describe({
  name: requireWholeAnthropicMessage.name,
  children: [
    it({
      name: 'ACCEPTS a body ending in message_stop, keep-alive and trailing [DONE] sentinel included',
      fn: async () => {
        expect(refusalOf({
          bodyText: `${OPENING}${TERMINATOR_FRAME}event: data\ndata: [DONE]\n\n`,
        },),).toBe('',);
      },
    },),

    it({
      name: 'REFUSES a body with no message_stop, naming the missing terminator',
      fn: async () => {
        expect(refusalOf({ bodyText: OPENING, },).includes('ended without message_stop',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a body cut inside its terminator frame, after the type and before the closing '
        + 'brace, which a search for the quoted word took as whole (ledger B87)',
      fn: async () => {
        expect(refusalOf({
          bodyText: `${OPENING}data: {"type":"message_stop"`,
        },).includes('ended without message_stop',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a body whose only message_stop is a value inside another frame (ledger B87)',
      fn: async () => {
        expect(refusalOf({
          bodyText: OPENING + frameOf({
            body: {
              type: 'content_block_start',
              index: 1,
              content_block: {
                type: 'tool_use',
                name: 'message_stop',
                input: {},
              },
            },
          },),
        },).includes('ended without message_stop',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a body carrying an error event even when message_stop follows, naming the '
        + 'error\'s type: the provider said why it stopped (ledger B87)',
      fn: async () => {
        /**
         Refusal of a body that reported an overloaded provider and then ended.
         */
        const refusal = refusalOf({
          bodyText: OPENING
            + frameOf({
              body: {
                type: 'error',
                error: {
                  type: 'overloaded_error',
                  message: 'Napping',
                },
              },
            },)
            + TERMINATOR_FRAME,
        },);
        expect(refusal.includes('error event (overloaded_error)',),).toBe(true,);
        expect(refusal.includes('Napping',),).toBe(false,);
      },
    },),

    it({
      name: 'CALLS AN ERROR UNNAMED rather than repeat a type that is not a protocol word: the '
        + 'refusal promises to quote nothing from the body, and an absent, empty, spaced or '
        + 'overlong type is text, not a name',
      fn: async () => {
        /**
         Error descriptors whose type a refusal may not repeat, each with
         the text that must stay out of it.
         */
        const unnamed = [
          {
            error: {
              type: 'Over loaded',
              message: 'Napping',
            },
            withheld: 'Over loaded',
          },
          {
            error: {
              type: '',
              message: 'Napping',
            },
            withheld: '()',
          },
          {
            error: {
              type: 'a'.repeat(65,),
              message: 'Napping',
            },
            withheld: 'a'.repeat(65,),
          },
          {
            error: 'napping',
            withheld: 'napping',
          },
        ];
        for (const { error, withheld, } of unnamed) {
          /**
           Refusal of a body ending in this error event.
           */
          const refusal = refusalOf({
            bodyText: OPENING + frameOf({
              body: {
                type: 'error',
                error,
              },
            },),
          },);
          expect(refusal.includes('error event (unnamed)',),).toBe(true,);
          expect(refusal.includes(withheld,),).toBe(false,);
        }
      },
    },),

    it({
      name: 'PASSES OVER a payload that is not a frame when the terminator arrived, since only the '
        + 'ending is read here and the fold refuses such a frame after the ladder',
      fn: async () => {
        expect(refusalOf({
          bodyText: `${OPENING}data: {not json\n\ndata: [1, 2]\n\n${TERMINATOR_FRAME}`,
        },),).toBe('',);
      },
    },),
  ],
},);
