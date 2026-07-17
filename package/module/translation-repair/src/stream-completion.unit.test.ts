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

import { MalformedCompletionError, } from './completion-shape.ts';
import { extractStreamedCompletion, } from './stream-completion.ts';

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
