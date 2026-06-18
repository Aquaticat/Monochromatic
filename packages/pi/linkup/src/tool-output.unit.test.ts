/**
 * Unit tests for Pi Linkup tool output helpers.
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
