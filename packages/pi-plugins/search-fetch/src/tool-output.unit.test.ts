/**
 * Unit tests for Pi Search Fetch tool output helpers.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createJsonContent,
  createLinkupToolOutput,
  createWarningContent,
  LINKUP_VISIBLE_JSON_MAX_BYTES,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Tool name fixture.
 */
const TOOL_NAME = 'linkup_web_search';

/**
 * Fixed behavior warning fixture.
 */
const FIXED_BEHAVIOR = 'This extension always uses fixed behavior.';

/**
 * Response fixture.
 */
const RESPONSE = { results: [], };

/**
 * Response fixture with object search results.
 */
const RESULTS_RESPONSE = {
  results: [
    {
      title: 'First',
      url: 'https://example.com/first',
    },
    {
      title: 'Second',
      url: 'https://example.com/second',
    },
  ],
} as const;

/**
 * Response fixture with results plus metadata.
 */
const RESULTS_WITH_EXTRA_KEY_RESPONSE = {
  results: [
    {
      title: 'First',
      url: 'https://example.com/first',
    },
  ],
  total: 1,
} as const;

/**
 * Markdown-only response fixture.
 */
const MARKDOWN_ONLY_RESPONSE = { markdown: '# Meow', } as const;

/**
 * Markdown response fixture with additional metadata.
 */
const MARKDOWN_WITH_EXTRA_KEY_RESPONSE = {
  markdown: '# Meow',
  title: 'Meow title',
} as const;

/**
 * Bytes in one kibibyte, matching Pi's truncation utilities.
 */
const BYTES_PER_KIBIBYTE = 1_024;

/**
 * Expected Linkup visible JSON cap in kibibytes.
 */
const EXPECTED_LINKUP_VISIBLE_JSON_KIBIBYTES = 100;

/**
 * JSON payload kibibytes that exceed Pi's core default but not Linkup's cap.
 */
const ABOVE_PI_DEFAULT_JSON_KIBIBYTES = 60;

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: createWarningContent.name,
      children: [
        it({
          name: 'names ignored keys and fixed behavior',
          fn: async () => {
            /**
             * Local value for warning.
             */
            const warning = createWarningContent({
              toolName: TOOL_NAME,
              ignoredKeys: ['depth', 'limit',],
              fixedBehavior: FIXED_BEHAVIOR,
            },);

            expect(warning.type,).toBe('text',);
            expect(warning.text,).toContain('depth, limit',);
            expect(warning.text,).toContain(FIXED_BEHAVIOR,);
          },
        },),
      ],
    },),
    describe({
      name: createJsonContent.name,
      children: [
        it({
          name: 'returns pretty JSON text when below truncation limits',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: RESPONSE,
            },);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toContain('"results"',);
            expect(result.fullJsonPath,).toBeUndefined();
          },
        },),
        it({
          name: 'returns inner results array as JSONL when requested',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: RESULTS_RESPONSE,
              renderResultsArrayAsJsonl: true,
            },);
            /**
             * Expected model-visible JSONL text.
             */
            const expectedJsonl = [
              '{"title":"First","url":"https://example.com/first"}',
              '{"title":"Second","url":"https://example.com/second"}',
            ].join('\n',);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toBe(expectedJsonl,);
            expect(result.content.text,).not.toContain('"results"',);
            expect(result.fullJsonPath,).toBeUndefined();
          },
        },),
        it({
          name: 'returns empty JSONL for empty results when requested',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: RESPONSE,
              renderResultsArrayAsJsonl: true,
            },);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toBe('',);
            expect(result.fullJsonPath,).toBeUndefined();
          },
        },),
        it({
          name: 'keeps JSON for results responses with extra fields',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: RESULTS_WITH_EXTRA_KEY_RESPONSE,
              renderResultsArrayAsJsonl: true,
            },);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toContain('"results"',);
            expect(result.content.text,).toContain('"total"',);
          },
        },),
        it({
          name: 'truncates JSONL and writes full JSONL to temp file',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: RESULTS_RESPONSE,
              renderResultsArrayAsJsonl: true,
              truncationOptions: {
                maxBytes: 10,
                maxLines: 10,
              },
            },);

            expect(result.content.text,).toContain('JSONL response truncated',);
            expect(result.fullJsonPath,).toBeDefined();
            if (result.fullJsonPath === undefined)
              throw new Error('missing full JSONL path',);
            expect(result.fullJsonPath.endsWith('/response.jsonl',),).toBe(true,);
            /**
             * Local value for fullJsonl.
             */
            const fullJsonl = await readFile(result.fullJsonPath, 'utf8',);
            expect(fullJsonl,).toContain('"title":"First"',);
            expect(fullJsonl,).not.toContain('"results"',);
          },
        },),
        it({
          name: 'returns raw markdown for single-field markdown responses',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: MARKDOWN_ONLY_RESPONSE,
            },);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toBe(MARKDOWN_ONLY_RESPONSE.markdown,);
            expect(result.content.text,).not.toContain('"markdown"',);
            expect(result.fullJsonPath,).toBeUndefined();
          },
        },),
        it({
          name: 'keeps JSON for markdown responses with extra fields',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: MARKDOWN_WITH_EXTRA_KEY_RESPONSE,
            },);

            expect(result.content.type,).toBe('text',);
            expect(result.content.text,).toContain('"markdown"',);
            expect(result.content.text,).toContain('"title"',);
            expect(result.content.text,).not.toBe(MARKDOWN_WITH_EXTRA_KEY_RESPONSE.markdown,);
          },
        },),
        it({
          name: 'keeps JSON above Pi default when below Linkup byte limit',
          fn: async () => {
            /**
             * Large string that would exceed Pi's 50 KiB default limit.
             */
            const largeText = 'x'.repeat(
              ABOVE_PI_DEFAULT_JSON_KIBIBYTES * BYTES_PER_KIBIBYTE,
            );
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: {
                largeText,
              },
            },);

            expect(LINKUP_VISIBLE_JSON_MAX_BYTES,).toBe(
              EXPECTED_LINKUP_VISIBLE_JSON_KIBIBYTES * BYTES_PER_KIBIBYTE,
            );
            expect(result.fullJsonPath,).toBeUndefined();
            expect(result.content.text,).not.toContain('JSON response truncated',);
          },
        },),
        it({
          name: 'truncates large JSON and writes full JSON to temp file',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createJsonContent({
              value: {
                long: 'abcdefghijklmnopqrstuvwxyz',
              },
              truncationOptions: {
                maxBytes: 10,
                maxLines: 10,
              },
            },);

            expect(result.content.text,).toContain('JSON response truncated',);
            expect(result.fullJsonPath,).toBeDefined();
            if (result.fullJsonPath === undefined)
              throw new Error('missing full JSON path',);
            /**
             * Local value for fullJson.
             */
            const fullJson = await readFile(result.fullJsonPath, 'utf8',);
            expect(fullJson,).toContain('abcdefghijklmnopqrstuvwxyz',);
          },
        },),
      ],
    },),
    describe({
      name: createLinkupToolOutput.name,
      children: [
        it({
          name: 'returns JSON content and details for model-visible response',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createLinkupToolOutput({
              toolName: TOOL_NAME,
              linkupResponse: RESPONSE,
              rawLinkupResponse: RESPONSE,
              ignoredKeys: [],
              fixedBehavior: FIXED_BEHAVIOR,
            },);

            expect(result.content,).toHaveLength(1,);
            expect(result.content[0]?.type,).toBe('text',);
            expect(result.details.linkupResponse,).toBe(RESPONSE,);
            expect(result.details.rawLinkupResponse,).toBe(RESPONSE,);
          },
        },),
        it({
          name: 'returns markdown content and details for markdown-only response',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createLinkupToolOutput({
              toolName: TOOL_NAME,
              linkupResponse: MARKDOWN_ONLY_RESPONSE,
              rawLinkupResponse: MARKDOWN_ONLY_RESPONSE,
              ignoredKeys: [],
              fixedBehavior: FIXED_BEHAVIOR,
            },);

            expect(result.content,).toHaveLength(1,);
            expect(result.content[0]?.type,).toBe('text',);
            if (result.content[0]?.type !== 'text')
              throw new Error('markdown content was not text',);
            expect(result.content[0].text,).toBe(MARKDOWN_ONLY_RESPONSE.markdown,);
            expect(result.details.linkupResponse,).toBe(MARKDOWN_ONLY_RESPONSE,);
            expect(result.details.rawLinkupResponse,).toBe(MARKDOWN_ONLY_RESPONSE,);
          },
        },),
        it({
          name: 'returns warning before JSON when ignored keys are present',
          fn: async () => {
            /**
             * Local value for result.
             */
            const result = await createLinkupToolOutput({
              toolName: TOOL_NAME,
              linkupResponse: RESPONSE,
              rawLinkupResponse: RESPONSE,
              ignoredKeys: ['depth',],
              fixedBehavior: FIXED_BEHAVIOR,
            },);

            expect(result.content,).toHaveLength(2,);
            expect(result.content[0]?.type,).toBe('text',);
            if (result.content[0]?.type !== 'text')
              throw new Error('warning content was not text',);
            expect(result.content[0].text,).toContain('depth',);
            expect(result.details.ignoredKeys,).toEqual(['depth',],);
          },
        },),
      ],
    },),
  ],
},);
