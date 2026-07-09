import {
  mkdir,
  mkdtempDisposable,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  normalizeFinalLf,
  normalizeGeneratedTextOutputs,
} from './final-newline.ts';

//region Pure normalization cases

/**
 * One pure final-LF normalization example.
 *
 * @example
 * ```ts
 * const fixture: NormalizationCase = {
 *   name: 'adds missing LF',
 *   input: 'content',
 *   expected: 'content\n',
 * };
 * ```
 */
type NormalizationCase = {
  readonly name: string;
  readonly input: string;
  readonly expected: string;
};

/**
 * Content cases covering every branch of final-LF normalization.
 *
 * @example
 * ```ts
 * NORMALIZATION_CASES.map(({ name }) => name);
 * ```
 */
const NORMALIZATION_CASES = [
  {
    name: 'adds missing final LF',
    input: 'content',
    expected: 'content\n',
  },
  {
    name: 'keeps exactly one final LF',
    input: 'content\n',
    expected: 'content\n',
  },
  {
    name: 'collapses multiple final LF bytes',
    input: 'content\n\n\n',
    expected: 'content\n',
  },
  {
    name: 'keeps empty content empty',
    input: '',
    expected: '',
  },
  {
    name: 'preserves interior blank lines',
    input: 'first\n\nsecond\n\n',
    expected: 'first\n\nsecond\n',
  },
] as const satisfies readonly NormalizationCase[];

//endregion Pure normalization cases

await describe({
  name: '',
  children: [
    describe({
      name: normalizeFinalLf.name,
      children: NORMALIZATION_CASES.map(
        function toNormalizationTest(fixture,) {
          return it({
            name: fixture.name,
            fn: async function verifiesNormalizationCase(): Promise<void> {
              expect(normalizeFinalLf(fixture.input,),).toBe(fixture.expected,);
            },
          },);
        },
      ),
    },),
    describe({
      name: normalizeGeneratedTextOutputs.name,
      children: [
        it({
          name: 'normalizes owned outputs recursively and is idempotent',
          fn: async function normalizesOwnedOutputs(): Promise<void> {
            /**
             * Disposable directory removed automatically when test scope exits.
             */
            await using fixtureDir = await mkdtempDisposable(
              join(tmpdir(), 'config-tsdown-final-newline-',),
            );
            /**
             * Nested output directory proving recursive discovery.
             */
            const nestedDir = join(fixtureDir.path, 'nested',);
            await mkdir(nestedDir, { recursive: true, },);

            await Promise.all([
              writeFile(join(fixtureDir.path, 'index.mjs',), 'export {};\n\n', 'utf8',),
              writeFile(join(fixtureDir.path, 'index.d.mts',), 'export type T = string;', 'utf8',),
              writeFile(join(nestedDir, 'chunk.cjs',), 'module.exports = {};\n', 'utf8',),
              writeFile(join(nestedDir, 'empty.d.ts',), '', 'utf8',),
              writeFile(join(fixtureDir.path, 'styles.css',), 'body {}\n\n', 'utf8',),
              writeFile(join(fixtureDir.path, 'index.mjs.map',), '{}\n\n', 'utf8',),
            ],);

            /**
             * Paths changed by first normalization pass.
             */
            const normalizedPaths = await normalizeGeneratedTextOutputs({
              outputDir: fixtureDir.path,
            },);

            expect(normalizedPaths,).toEqual([
              'index.d.mts',
              'index.mjs',
            ],);
            expect(await readFile(join(fixtureDir.path, 'index.mjs',), 'utf8',),)
              .toBe('export {};\n',);
            expect(await readFile(join(fixtureDir.path, 'index.d.mts',), 'utf8',),)
              .toBe('export type T = string;\n',);
            expect(await readFile(join(nestedDir, 'chunk.cjs',), 'utf8',),)
              .toBe('module.exports = {};\n',);
            expect(await readFile(join(nestedDir, 'empty.d.ts',), 'utf8',),)
              .toBe('',);
            expect(await readFile(join(fixtureDir.path, 'styles.css',), 'utf8',),)
              .toBe('body {}\n\n',);
            expect(await readFile(join(fixtureDir.path, 'index.mjs.map',), 'utf8',),)
              .toBe('{}\n\n',);

            /**
             * Paths changed by second pass; empty proves idempotence.
             */
            const repeatedPaths = await normalizeGeneratedTextOutputs({
              outputDir: fixtureDir.path,
            },);
            expect(repeatedPaths,).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
