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
