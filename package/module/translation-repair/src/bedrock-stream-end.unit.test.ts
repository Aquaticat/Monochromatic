/**
 * Tests for how a Bedrock stream is known to be whole: the sentinel on the
 * Gemma route, the usage chunk on the gpt-oss route, and the sentinel supplied
 * to the shared reader where the route sends none.
 *
 * Streams are shaped as the probes of 2026-09-07 captured them; the words are
 * cat-themed invention.
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
  requireBedrockStreamEnd,
  withDoneSentinel,
} from '../dist/final/node/index.mjs';

/**
 * One content chunk.
 */
const CONTENT_CHUNK = 'data: {"choices":[{"index":0,"delta":{"content":"{\\"spot\\":\\"sunbeam\\"}"},"finish_reason":null}]}\n\n';

/**
 * Chunk carrying the usage block and no choices, as the gpt-oss route ends.
 */
const USAGE_CHUNK = 'data: {"choices":[],"usage":{"prompt_tokens":98,"completion_tokens":75,"total_tokens":173}}\n\n';

/**
 * Gemma route stream: content, usage, sentinel.
 */
const GEMMA_STREAM = `${CONTENT_CHUNK}${USAGE_CHUNK}data: [DONE]\n\n`;

/**
 * gpt-oss route stream: content, usage, nothing more.
 */
const GPT_OSS_STREAM = `${CONTENT_CHUNK}${USAGE_CHUNK}`;

await describe({
  name: requireBedrockStreamEnd.name,
  children: [
    it({
      name: 'ACCEPTS a sentinel-ended stream on the sentinel route and REFUSES one cut off before it',
      fn: async () => {
        expect(function whole(): void {
          requireBedrockStreamEnd({
            bodyText: GEMMA_STREAM,
            streamEnd: 'done-sentinel',
          },);
        },).not.toThrow();
        expect(function cut(): void {
          requireBedrockStreamEnd({
            bodyText: GPT_OSS_STREAM,
            streamEnd: 'done-sentinel',
          },);
        },).toThrow(MalformedCompletionError,);
      },
    },),

    it({
      name: 'ACCEPTS a stream ending on its usage chunk on the usage route and REFUSES one that never '
        + 'reached it, since the gpt-oss route sends no sentinel (measured 2026-09-07)',
      fn: async () => {
        expect(function whole(): void {
          requireBedrockStreamEnd({
            bodyText: GPT_OSS_STREAM,
            streamEnd: 'usage-chunk',
          },);
        },).not.toThrow();
        expect(function cut(): void {
          requireBedrockStreamEnd({
            bodyText: CONTENT_CHUNK,
            streamEnd: 'usage-chunk',
          },);
        },).toThrow(MalformedCompletionError,);
      },
    },),

    it({
      name: 'IGNORES a line that is not JSON while looking for the usage chunk, as a comment line or a '
        + 'torn frame is not one',
      fn: async () => {
        expect(function torn(): void {
          requireBedrockStreamEnd({
            bodyText: `: keepalive\n\ndata: {"choices":[{"index":0,"de\n\n${USAGE_CHUNK}`,
            streamEnd: 'usage-chunk',
          },);
        },).not.toThrow();
      },
    },),
  ],
},);

await describe({
  name: withDoneSentinel.name,
  children: [
    it({
      name: 'SUPPLIES THE SENTINEL on the usage route so the shared reader folds the stream, and leaves '
        + 'a sentinel route\'s stream as it came',
      fn: async () => {
        expect(withDoneSentinel({
          bodyText: GEMMA_STREAM,
          streamEnd: 'done-sentinel',
        },),).toBe(GEMMA_STREAM,);

        /**
         * gpt-oss stream as the shared reader receives it.
         */
        const supplied = withDoneSentinel({
          bodyText: GPT_OSS_STREAM,
          streamEnd: 'usage-chunk',
        },);
        expect(supplied.endsWith('data: [DONE]\n',),).toBe(true,);

        /**
         * What the shared reader makes of it.
         */
        const extracted = extractStreamedCompletion({ bodyText: supplied, },);
        expect(extracted.text,).toBe('{"spot":"sunbeam"}',);
        expect(extracted.usage?.completion_tokens,).toBe(75,);
      },
    },),
  ],
},);
