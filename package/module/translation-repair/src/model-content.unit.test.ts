/**
 * Tests for tolerant model-JSON parsing and usage-note formatting.
 * Fence and thinking-block handling is covered beside the client in
 * `synthetic-client.unit.test.ts`; this file covers the two helpers
 * that had only indirect coverage.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  formatUsageNote,
  stripChannelMarker,
  parseModelJson,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: parseModelJson.name,
      children: [
        it({
          name: 'parses valid JSON into data',
          fn: async () => {
            expect(parseModelJson({ text: '{"cat":"喵"}', },),).toEqual({
              parsed: true,
              value: { cat: '喵', },
            },);
          },
        },),
        it({
          name: 'returns failure detail as data instead of throwing',
          fn: async () => {
            const attempt = parseModelJson({ text: '{"cat":', },);
            expect(attempt.parsed,).toBe(false,);
            if (attempt.parsed)
              throw new Error('unreachable: asserted failure',);
            expect(attempt.detail,).toContain('SyntaxError',);
          },
        },),
      ],
    },),
    describe({
      name: formatUsageNote.name,
      children: [
        it({
          name: 'formats reported component counts',
          fn: async () => {
            expect(
              formatUsageNote({
                extracted: {
                  text: '喵',
                  usage: {
                    prompt_tokens: 3,
                    completion_tokens: 7,
                  },
                },
              },),
            ).toBe(', 3+7 tokens',);
          },
        },),
        it({
          name: 'stays empty when the server reported no usage',
          fn: async () => {
            expect(formatUsageNote({ extracted: { text: '喵', }, },),).toBe('',);
          },
        },),
      ],
    },),
  ],
},);

await describe({
  name: stripChannelMarker.name,
  children: [
    it({
      name: 'strips the channel marker a provider began prefixing to correct '
        + 'JSON. Kimi-K3 returned complete, valid content behind |> on '
        + '2026-08-12, and every structured call from it failed to parse: 507 '
        + 'schema-mismatches in one pass, in every role it holds, on unchanged '
        + 'pipeline code',
      fn: async () => {
        expect(stripChannelMarker({
          text: String.raw`|>{"count":2,"first":"Mittens"}`,
        },),).toBe(String.raw`{"count":2,"first":"Mittens"}`,);
      },
    },),

    it({
      name: 'leaves the marker in place when what follows is NOT a JSON value, '
        + 'so a reply that merely opens with those characters and then '
        + 'apologizes still fails to parse and reaches the refusal detector '
        + 'rather than being silently mended',
      fn: async () => {
        expect(stripChannelMarker({ text: '|> I cannot help with that.', },),)
          .toBe('|> I cannot help with that.',);
      },
    },),

    it({
      name: 'leaves ordinary content untouched, since every other model on the '
        + 'roster returns bare JSON and must keep parsing exactly as before',
      fn: async () => {
        expect(stripChannelMarker({
          text: String.raw`{"count":2}`,
        },),).toBe(String.raw`{"count":2}`,);
      },
    },),
  ],
},);
