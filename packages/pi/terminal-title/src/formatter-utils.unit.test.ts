/**
 * Tests for formatter utilities.
 *
 * Covers truncate, shortPath, stringField, field, pathFormat, quotedFormat,
 * and shortCommand.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  field,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  shortCommand,
  shortPath,
  stringField,
  truncate,
} from './formatter-utils.ts';

await describe({
  name: '',
  children: [
    //region truncate

    describe({
      name: truncate.name,
      children: [
        it({
          name: 'returns original string when within limit',
          fn: async () => {
            expect(truncate('hello', 10,),).toBe('hello',);
          },
        },),
        it({
          name: 'truncates and appends ellipsis when over limit',
          fn: async () => {
            expect(truncate('hello world', 6,),).toBe('hello…',);
          },
        },),
        it({
          name: 'returns original when exactly at limit',
          fn: async () => {
            expect(truncate('hello', 5,),).toBe('hello',);
          },
        },),
        it({
          name: 'handles single character truncation',
          fn: async () => {
            expect(truncate('ab', 2,),).toBe('ab',);
            expect(truncate('abc', 2,),).toBe('a…',);
          },
        },),
      ],
    },),

    //endregion truncate

    //region shortPath

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
          name: 'returns filename when no separator present',
          fn: async () => {
            expect(shortPath('README.md',),).toBe('README.md',);
          },
        },),
      ],
    },),

    //endregion shortPath

    //region stringField

    describe({
      name: stringField.name,
      children: [
        it({
          name: 'returns string value when present',
          fn: async () => {
            expect(stringField({ path: '/foo.ts', }, 'path',),).toBe('/foo.ts',);
          },
        },),
        it({
          name: 'returns undefined for missing key',
          fn: async () => {
            expect(stringField({ path: '/foo.ts', }, 'missing',),).toBe(undefined,);
          },
        },),
        it({
          name: 'returns undefined for non-string value',
          fn: async () => {
            expect(stringField({ count: 42, }, 'count',),).toBe(undefined,);
          },
        },),
        it({
          name: 'returns undefined for null value',
          fn: async () => {
            expect(stringField({ path: null, }, 'path',),).toBe(undefined,);
          },
        },),
      ],
    },),

    //endregion stringField

    //region field

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
          name: 'returns undefined when field is absent',
          fn: async () => {
            const extractPath = field('path',);
            expect(extractPath({ other: 'value', },),).toBe(undefined,);
          },
        },),
      ],
    },),

    //endregion field

    //region pathFormat

    describe({
      name: pathFormat.name,
      children: [
        it({
          name: 'formats present tense with short path',
          fn: async () => {
            const fmt = pathFormat({
              pre: 'Reading',
              post: 'Read',
            },);
            expect(fmt('/home/user/src/index.ts', 'pre',),).toBe('Reading index.ts',);
          },
        },),
        it({
          name: 'formats past tense with short path',
          fn: async () => {
            const fmt = pathFormat({
              pre: 'Editing',
              post: 'Edited',
            },);
            expect(fmt('/app/config.json', 'post',),).toBe('Edited config.json',);
          },
        },),
      ],
    },),

    //endregion pathFormat

    //region quotedFormat

    describe({
      name: quotedFormat.name,
      children: [
        it({
          name: 'formats present tense with quotes and truncation',
          fn: async () => {
            const fmt = quotedFormat({
              pre: 'Searching',
              post: 'Searched',
            },);
            expect(fmt('TODO', 'pre',),).toBe('Searching "TODO"',);
          },
        },),
        it({
          name: 'formats past tense with quotes',
          fn: async () => {
            const fmt = quotedFormat({
              pre: 'Finding',
              post: 'Found',
            },);
            expect(fmt('*.ts', 'post',),).toBe('Found "*.ts"',);
          },
        },),
        it({
          name: 'truncates long patterns to MAX_PATTERN_LENGTH',
          fn: async () => {
            const fmt = quotedFormat({
              pre: 'Searching',
              post: 'Searched',
            },);
            const longPattern = 'a'.repeat(MAX_PATTERN_LENGTH + 10,);
            const result = fmt(longPattern, 'pre',);
            // Result should be 'Searching "' + truncated(30) + '"'
            const truncated = result.slice(
              result.indexOf('"',) + 1,
              result.lastIndexOf('"',),
            );
            expect(truncated.length <= MAX_PATTERN_LENGTH,).toBe(true,);
          },
        },),
      ],
    },),

    //endregion quotedFormat

    //region shortCommand

    describe({
      name: shortCommand.name,
      children: [
        it({
          name: 'strips timeout prefix',
          fn: async () => {
            expect(shortCommand('timeout 10 npm test',),).toBe('npm test',);
          },
        },),
        it({
          name: 'strips env command with its argument',
          fn: async () => {
            // env <arg> strips the env keyword and its next token
            expect(shortCommand('env NODE_ENV=prod npm start',),).toBe('npm start',);
          },
        },),
        it({
          name: 'strips env-var assignment',
          fn: async () => {
            expect(shortCommand('FOO=bar ls -la',),).toBe('ls -la',);
          },
        },),
        it({
          name: 'strips nice with its argument',
          fn: async () => {
            // nice <arg> strips the nice keyword and its next token
            expect(shortCommand('nice -n 10 cargo build',),).toBe('10 cargo build',);
          },
        },),
        it({
          name: 'strips nohup with its argument',
          fn: async () => {
            // nohup <arg> strips the nohup keyword and its next token
            expect(shortCommand('nohup /usr/bin/server start',),).toBe('start',);
          },
        },),
        it({
          name: 'returns clean command unchanged',
          fn: async () => {
            expect(shortCommand('npm test',),).toBe('npm test',);
          },
        },),
        it({
          name: 'strips stacked prefixes',
          fn: async () => {
            // env <arg> strips env + next token; then timeout <arg> strips those
            expect(shortCommand('env timeout 10 npm test',),).toBe('10 npm test',);
          },
        },),
      ],
    },),
    //endregion shortCommand
  ],
},);
