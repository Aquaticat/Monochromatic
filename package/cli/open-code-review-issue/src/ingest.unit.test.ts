import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseStructuredInput, } from '../dist/final/node/index.mjs';

await describe({
  name: parseStructuredInput.name,
  children: [
    it({
      name: 'accepts a complete OCR JSON result',
      fn: () => {
        /**
         * Complete result fixture carrying repository-head provenance.
         */
        const text = JSON.stringify({
          status: 'complete',
          comments: [
            {
              path: 'src/example.ts',
              content: 'Boundary handling is incorrect.',
              existing_code: 'return value + 1;',
              suggestion_code: 'return value;',
              start_line: 4,
              end_line: 5,
              category: 'bug',
              severity: 'high',
              thinking: 'private reasoning',
            },
          ],
          manifest: {
            input: {
              resolved_head: '0123456789abcdef0123456789abcdef01234567',
            },
          },
        },);

        /**
         * Normalized adapter input.
         */
        const result = parseStructuredInput({ text, },);

        expect(result,).toStrictEqual({
          inputKind: 'result',
          resolvedHead: '0123456789abcdef0123456789abcdef01234567',
          findings: [
            {
              position: {
                kind: 'record',
                value: 1,
              },
              path: 'src/example.ts',
              content: 'Boundary handling is incorrect.',
              existingCode: 'return value + 1;',
              suggestionCode: 'return value;',
              startLine: 4,
              endLine: 5,
              category: 'bug',
              severity: 'high',
            },
          ],
        },);
      },
    },),
    it({
      name: 'accepts a bare OCR comment array',
      fn: () => {
        /**
         * Bare comments fixture with optional metadata absent.
         */
        const text = JSON.stringify([
          {
            path: 'src/plain.ts',
            content: 'Use the guarded branch.',
            start_line: 7,
            end_line: 7,
          },
        ],);

        /**
         * Normalized adapter input.
         */
        const result = parseStructuredInput({ text, },);

        expect(result,).toStrictEqual({
          inputKind: 'comments',
          findings: [
            {
              position: {
                kind: 'record',
                value: 1,
              },
              path: 'src/plain.ts',
              content: 'Use the guarded branch.',
              existingCode: '',
              suggestionCode: '',
              startLine: 7,
              endLine: 7,
            },
          ],
        },);
      },
    },),
  ],
},);
