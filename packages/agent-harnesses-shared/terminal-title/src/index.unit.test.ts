/**
 * Tests for shared terminal title formatting helpers.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  field,
  FIELD_ABSENT,
  formatToolTitle,
  lookupToolTitleEntry,
  MAX_PATTERN_LENGTH,
  NO_STRING_FIELD,
  pathFormat,
  prefixedTitle,
  quotedFormat,
  shortCommand,
  shortPath,
  stringField,
  stripCommandNoise,
  truncate,
  type ToolTitleRegistry,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    //region Primitive formatting

    describe({
      name: truncate.name,
      children: [
        it({
          name: 'returns original string when within limit',
          fn: async () => {
            expect(truncate({ value: 'hello', maxLength: 10, },),).toBe('hello',);
          },
        },),
        it({
          name: 'returns original string when exactly at limit',
          fn: async () => {
            expect(truncate({ value: 'hello', maxLength: 5, },),).toBe('hello',);
          },
        },),
        it({
          name: 'truncates with ellipsis when over limit',
          fn: async () => {
            expect(truncate({ value: 'hello world', maxLength: 6, },),).toBe('hello…',);
          },
        },),
      ],
    },),

    describe({
      name: shortPath.name,
      children: [
        it({
          name: 'extracts filename from absolute path',
          fn: async () => {
            expect(shortPath('/home/user/src/index.ts',),).toBe('index.ts',);
          },
        },),
        it({
          name: 'extracts filename from relative path',
          fn: async () => {
            expect(shortPath('./src/config.json',),).toBe('config.json',);
          },
        },),
        it({
          name: 'returns input when no separator exists',
          fn: async () => {
            expect(shortPath('README.md',),).toBe('README.md',);
          },
        },),
      ],
    },),

    //endregion Primitive formatting

    //region Field extraction

    describe({
      name: stringField.name,
      children: [
        it({
          name: 'returns string value when present',
          fn: async () => {
            expect(stringField({ input: { path: '/foo.ts', }, key: 'path', },),).toBe('/foo.ts',);
          },
        },),
        it({
          name: 'returns FIELD_ABSENT for missing key',
          fn: async () => {
            expect(stringField({ input: { path: '/foo.ts', }, key: 'missing', },),).toBe(FIELD_ABSENT,);
          },
        },),
        it({
          name: 'returns FIELD_ABSENT for non-string value',
          fn: async () => {
            expect(stringField({ input: { count: 42, }, key: 'count', },),).toBe(FIELD_ABSENT,);
          },
        },),
        it({
          name: 'keeps the pi absence alias identical',
          fn: async () => {
            expect(NO_STRING_FIELD,).toBe(FIELD_ABSENT,);
          },
        },),
      ],
    },),

    describe({
      name: field.name,
      children: [
        it({
          name: 'creates extractor for named field',
          fn: async () => {
            const extractPath = field('path',);
            expect(extractPath({ path: '/foo.ts', },),).toBe('/foo.ts',);
          },
        },),
        it({
          name: 'returns FIELD_ABSENT when field is absent',
          fn: async () => {
            const extractPath = field('path',);
            expect(extractPath({ other: 'value', },),).toBe(FIELD_ABSENT,);
          },
        },),
      ],
    },),

    //endregion Field extraction

    //region Formatter builders

    describe({
      name: pathFormat.name,
      children: [
        it({
          name: 'formats present tense with short path',
          fn: async () => {
            const formatPath = pathFormat({ pre: 'Reading', post: 'Read', },);
            expect(formatPath('/home/user/src/index.ts', 'pre',),).toBe('Reading index.ts',);
          },
        },),
        it({
          name: 'formats past tense with short path',
          fn: async () => {
            const formatPath = pathFormat({ pre: 'Editing', post: 'Edited', },);
            expect(formatPath('/app/config.json', 'post',),).toBe('Edited config.json',);
          },
        },),
      ],
    },),

    describe({
      name: quotedFormat.name,
      children: [
        it({
          name: 'formats present tense with quotes',
          fn: async () => {
            const formatQuoted = quotedFormat({ pre: 'Searching', post: 'Searched', },);
            expect(formatQuoted('TODO', 'pre',),).toBe('Searching "TODO"',);
          },
        },),
        it({
          name: 'truncates long values to MAX_PATTERN_LENGTH',
          fn: async () => {
            const formatQuoted = quotedFormat({ pre: 'Finding', post: 'Found', },);
            const longPattern = 'a'.repeat(MAX_PATTERN_LENGTH + 10,);
            const result = formatQuoted(longPattern, 'post',);
            const quotedValue = result.slice(
              result.indexOf('"',) + 1,
              result.lastIndexOf('"',),
            );
            expect(quotedValue.length <= MAX_PATTERN_LENGTH,).toBe(true,);
          },
        },),
      ],
    },),

    //endregion Formatter builders

    //region Command shortening

    describe({
      name: shortCommand.name,
      children: [
        it({
          name: 'leaves plain command untouched',
          fn: async () => {
            expect(shortCommand('ls -la',),).toBe('ls -la',);
          },
        },),
        it({
          name: 'strips env-var assignment',
          fn: async () => {
            expect(shortCommand('NODE_ENV=prod ls',),).toBe('ls',);
          },
        },),
        it({
          name: 'strips empty env-var assignment',
          fn: async () => {
            expect(shortCommand('FOO= ls -la',),).toBe('ls -la',);
          },
        },),
        it({
          name: 'strips wrapper command and argument token',
          fn: async () => {
            expect(shortCommand('timeout 5 ls',),).toBe('ls',);
          },
        },),
        it({
          name: 'matches legacy chained env wrapper behavior',
          fn: async () => {
            expect(shortCommand('NODE_ENV=prod env timeout 5 ls -la',),).toBe('5 ls -la',);
          },
        },),
        it({
          name: 'does not strip leading dash token',
          fn: async () => {
            expect(shortCommand('-x=1 ls',),).toBe('-x=1 ls',);
          },
        },),
        it({
          name: 'returns wrapper verbatim when it has no argument',
          fn: async () => {
            expect(shortCommand('timeout',),).toBe('timeout',);
          },
        },),
        it({
          name: 'strips many chained env prefixes with a linear scan',
          fn: async () => {
            expect(shortCommand(`${'A=1 '.repeat(100_000,)}cmd`,),).toBe('cmd',);
          },
        },),
      ],
    },),

    describe({
      name: stripCommandNoise.name,
      children: [
        it({
          name: 'supports pi legacy timeout title behavior',
          fn: async () => {
            expect(stripCommandNoise('env timeout 10 npm test',),).toBe('10 npm test',);
          },
        },),
      ],
    },),

    //endregion Command shortening

    //region Registry formatting

    describe({
      name: lookupToolTitleEntry.name,
      children: [
        it({
          name: 'returns entry for registered tool',
          fn: async () => {
            const registry: ToolTitleRegistry = {
              Read: {
                extract: field('file_path',),
                format: pathFormat({ pre: 'Reading', post: 'Read', },),
                fallback: { pre: 'Reading file', post: 'Read file', },
              },
            };
            expect(lookupToolTitleEntry({ registry, toolName: 'Read', },),).toBe(registry.Read,);
          },
        },),
        it({
          name: 'returns undefined for unregistered tool',
          fn: async () => {
            expect(lookupToolTitleEntry({ registry: {}, toolName: 'Unknown', },),).toBeUndefined();
          },
        },),
      ],
    },),

    describe({
      name: formatToolTitle.name,
      children: [
        it({
          name: 'formats registered tool with extracted value',
          fn: async () => {
            const registry: ToolTitleRegistry = {
              Read: {
                extract: field('file_path',),
                format: pathFormat({ pre: 'Reading', post: 'Read', },),
                fallback: { pre: 'Reading file', post: 'Read file', },
              },
            };
            expect(
              formatToolTitle({
                registry,
                toolName: 'Read',
                args: { file_path: '/tmp/index.ts', },
                tense: 'pre',
                unknownToolTitle: ({ toolName, }) => toolName,
              },),
            ).toBe('Reading index.ts',);
          },
        },),
        it({
          name: 'uses tense fallback when extractor returns FIELD_ABSENT',
          fn: async () => {
            const registry: ToolTitleRegistry = {
              Read: {
                extract: field('file_path',),
                format: pathFormat({ pre: 'Reading', post: 'Read', },),
                fallback: { pre: 'Reading file', post: 'Read file', },
              },
            };
            expect(
              formatToolTitle({
                registry,
                toolName: 'Read',
                args: {},
                tense: 'post',
                unknownToolTitle: ({ toolName, }) => toolName,
              },),
            ).toBe('Read file',);
          },
        },),
        it({
          name: 'delegates unknown tools to host fallback',
          fn: async () => {
            expect(
              formatToolTitle({
                registry: {},
                toolName: 'mcp__weather',
                args: { city: 'Tokyo', },
                tense: 'pre',
                unknownToolTitle: ({ toolName, tense, }) => `${tense}:${toolName}`,
              },),
            ).toBe('pre:mcp__weather',);
          },
        },),
      ],
    },),

    //endregion Registry formatting

    //region Prefixing

    describe({
      name: prefixedTitle.name,
      children: [
        it({
          name: 'adds prefix before title body',
          fn: async () => {
            expect(prefixedTitle({ prefix: 'π', body: 'Reading index.ts', maxLength: 60, },),).toBe(
              'π Reading index.ts',
            );
          },
        },),
        it({
          name: 'truncates after prefixing',
          fn: async () => {
            const result = prefixedTitle({
              prefix: '✳',
              body: 'a'.repeat(200,),
              maxLength: 60,
            },);
            expect(result.length <= 60,).toBe(true,);
            expect(result.startsWith('✳ ',),).toBe(true,);
          },
        },),
      ],
    },),

    //endregion Prefixing
  ],
},);
