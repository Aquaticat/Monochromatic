/**
 * Tests for SSE stream reassembly.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  extractStreamedCompletion,
  MalformedCompletionError,
} from '../dist/final/node/index.mjs';

await describe({
  name: extractStreamedCompletion.name,
  children: [
    it({
      name: 'reassembles content deltas, keeps last usage, ignores reasoning and empty events',
      fn: async () => {
        /** Drained stream mixing content, reasoning, empty, and usage events. */
        const body = [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}',
          'data: {"choices":[{"delta":{"reasoning_content":"猫在想事情"}}]}',
          String.raw`data: {"choices":[{"delta":{"content":"{\"a\":"}}]}`,
          'data: {"choices":[{"delta":{"content":"1}"}}]}',
          'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":7}}',
          'data: [DONE]',
          '',
        ].join('\n\n',);
        expect(extractStreamedCompletion({ bodyText: body, },),).toEqual({
          text: '{"a":1}',
          usage: {
            prompt_tokens: 5,
            completion_tokens: 7,
          },
        },);
      },
    },),

    it({
      name: 'folds refusal deltas into the first-class refusal field',
      fn: async () => {
        /** Drained stream refusing across two deltas. */
        const body = [
          'data: {"choices":[{"delta":{"refusal":"Request declined "}}]}',
          'data: {"choices":[{"delta":{"refusal":"by policy."}}]}',
          'data: [DONE]',
          '',
        ].join('\n\n',);
        expect(extractStreamedCompletion({ bodyText: body, },),).toEqual({
          text: '',
          refusal: 'Request declined by policy.',
        },);
      },
    },),

    it({
      name: 'throws when the stream ends without its terminator',
      fn: async () => {
        /** Value caught from a cut-off stream. */
        let caught: unknown;
        try {
          extractStreamedCompletion({
            bodyText: 'data: {"choices":[{"delta":{"content":"half"}}]}\n',
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof MalformedCompletionError,).toBe(true,);
      },
    },),

    it({
      name: 'throws on events that are not valid JSON objects',
      fn: async () => {
        /** Value caught from a garbage event. */
        let caught: unknown;
        try {
          extractStreamedCompletion({
            bodyText: 'data: not-json\n\ndata: [DONE]\n',
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof MalformedCompletionError,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: 'finish reason folding',
  children: [
    it({
      name: 'READS the reason off the closing event, whose delta is empty',
      fn: async () => {
        // THE ORDERING THIS PINS. An OpenAI-compatible stream closes with an
        // event carrying an EMPTY delta beside the reason. A fold that checked
        // the delta first and returned early would discard exactly the event
        // worth reading, and every stream would report no reason at all.
        const body = [
          String.raw`data: {"choices":[{"delta":{"content":"{\"a\":"}}]}`,
          'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
          'data: [DONE]',
          '',
        ].join('\n\n',);
        const extracted = extractStreamedCompletion({ bodyText: body, },);
        expect(extracted.finishReason,).toBe('length',);
        expect(extracted.text,).toBe('{"a":',);
      },
    },),
    it({
      name: 'KEEPS the LAST reason, since that event closes the stream',
      fn: async () => {
        const body = [
          'data: {"choices":[{"delta":{"content":"x"},"finish_reason":null}]}',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
          'data: [DONE]',
          '',
        ].join('\n\n',);
        expect(extractStreamedCompletion({ bodyText: body, },).finishReason,).toBe('stop',);
      },
    },),
    it({
      name: 'REPORTS no reason at all when the provider sends none',
      fn: async () => {
        // ABSENT RATHER THAN DEFAULTED. Reading a missing field as `stop`
        // would assert the very thing this exists to establish.
        const body = [
          'data: {"choices":[{"delta":{"content":"x"}}]}',
          'data: [DONE]',
          '',
        ].join('\n\n',);
        expect(extractStreamedCompletion({ bodyText: body, },).finishReason,).toBe(undefined,);
      },
    },),
  ],
},);
