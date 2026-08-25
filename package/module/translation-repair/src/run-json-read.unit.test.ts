/**
 * Tests for reading a run file's JSON without ever quoting it.
 *
 * THE ABSENCE CASES ARE THE POINT. This module exists because V8 hands a parse
 * refusal a synthetic script whose source is the text it was given, so an
 * unguarded read prints the file. Every case here that asserts a word is MISSING
 * would pass again the moment someone forwards `error.message` through, which is
 * exactly the change that reopens the defect.
 *
 * Fixture wording is cat-themed invention, so no corpus content appears here,
 * and each fixture carries a word found nowhere else in the case so an assertion
 * of absence cannot pass by accident.
 *
 * @module
 */

import {
  mkdtemp,
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
  readRunJson,
  RunJsonUnreadableError,
} from '../dist/final/node/index.mjs';

//region Run JSON read tests

/**
 * Offset the truncated fixture stops being valid JSON at.
 *
 * MEASURED, not chosen: the fixture is 27 characters long and V8 reports the
 * position it ran out at, so a fixture edited without re-measuring fails here
 * rather than silently checking nothing.
 */
const TRUNCATION_BYTE = 27;

/**
 * Writes one file into a disposable directory and returns its path.
 *
 * ON A THROWAWAY, never a run directory: these cases write malformed files on
 * purpose, and a real run's ledger is the thing they are protecting.
 *
 * @param name - file name to write under the disposable root
 *
 * @param text - exact bytes to write, malformed on purpose in most cases
 *
 * @returns Path the case should read
 *
 * @example
 * ```ts
 * const path = await fixture({ name: 'one.json', text: '{}', },);
 * ```
 */
async function fixture(
  {
    name,
    text,
  }: {
    readonly name: string;
    readonly text: string;
  },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'run-json-read-',
  ),);

  /**
   * Where this case's file lands.
   */
  const path = join(
    dir,
    name,
  );

  await writeFile(
    path,
    text,
    'utf8',
  );

  return path;
}

/**
 * Reads a path and returns the refusal, failing the case where none came.
 *
 * @param path - file expected to refuse
 *
 * @returns Refusal the read raised
 *
 * @throws {@link Error} where the read returned instead of refusing
 *
 * @example
 * ```ts
 * const refusal = await refusalFrom({ path, },);
 * ```
 */
async function refusalFrom(
  { path, }: { readonly path: string; },
): Promise<RunJsonUnreadableError> {
  try {
    await readRunJson({ path, },);
  } catch (error) {
    if (error instanceof RunJsonUnreadableError)
      return error;

    throw new Error(
      `refused with ${String(error,)} rather than RunJsonUnreadableError`,
      { cause: error, },
    );
  }

  throw new Error('read returned a value where the case required a refusal',);
}

await describe({
  name: readRunJson.name,
  children: [
    it({
      name: 'ACCEPTS well-formed JSON and returns what it held',
      fn: async () => {
        expect(await readRunJson({
          path: await fixture({
            name: 'good.json',
            text: '{"cat":"Marmalade","naps":3}',
          },),
        },),).toEqual({
          cat: 'Marmalade',
          naps: 3,
        },);
      },
    },),
    it({
      name: 'REFUSES an absent file by its filesystem code, not by its class',
      fn: async () => {
        /**
         * Path inside a real directory that holds no such file.
         */
        const missing = join(
          await mkdtemp(join(
            tmpdir(),
            'run-json-read-',
          ),),
          'nothing-here.json',
        );

        expect((await refusalFrom({ path: missing, },)).failure,).toBe('ENOENT',);
      },
    },),
    it({
      name: 'REFUSES truncated JSON and keeps the byte offset, which says where it stopped',
      fn: async () => {
        /**
         * Refusal from a file that is valid JSON until it simply stops.
         */
        const refusal = await refusalFrom({
          path: await fixture({
            name: 'cut.json',
            text: '{"cat":"Marmalade","naps":3',
          },),
        },);

        expect(refusal.failure,).toBe('SyntaxError',);
        expect(refusal.at,).toBe(TRUNCATION_BYTE,);
        expect(refusal.message.includes('at byte 27',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a file that is not JSON at all and states no offset, because none was given',
      fn: async () => {
        /**
         * Refusal from prose, which V8 reports without a position.
         */
        const refusal = await refusalFrom({
          path: await fixture({
            name: 'prose.json',
            text: 'Marmalade the tabby dozed by the radiator all afternoon',
          },),
        },);

        expect(refusal.at,).toBe('unstated',);
        expect(refusal.message.includes('at byte',),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES an empty file, which states no offset either',
      fn: async () => {
        expect((await refusalFrom({
          path: await fixture({
            name: 'empty.json',
            text: '',
          },),
        },)).at,).toBe('unstated',);
      },
    },),
    it({
      name: 'NAMES the file by base name, so a run path that could name a person stays out of it',
      fn: async () => {
        /**
         * Refusal whose file sits under a directory named after a person.
         */
        const refusal = await refusalFrom({
          path: await fixture({
            name: 'contest.json',
            text: 'not json',
          },),
        },);

        /**
         * Directory the fixture actually sits under, which the refusal must not
         * name: under `artifacts/` the surrounding path is a person's entry id.
         */
        const root = tmpdir();

        expect(refusal.file,).toBe('contest.json',);
        expect(refusal.message.includes(root,),).toBe(false,);
      },
    },),
    it({
      name: 'CARRIES NO WORD OF THE FILE, which is the defect this module exists for',
      fn: async () => {
        /**
         * Wording V8 quotes back verbatim inside its own refusal message.
         *
         * EXACTLY TEN CHARACTERS, AND FIRST IN THE FILE, because that is the
         * window V8 quotes. A longer word would be cut to its first ten and this
         * case would pass even against a reader that forwards the message
         * whole, which is an assertion that cannot fail and proves nothing.
         * Confirmed against `JSON.parse` directly: the message for this exact
         * text reads `Unexpected token 'B', "Bixbyfluff"... is not valid JSON`.
         */
        const distinctive = 'Bixbyfluff';

        /**
         * Refusal from a file whose first bytes are that wording.
         */
        const refusal = await refusalFrom({
          path: await fixture({
            name: 'leak.json',
            text: `${distinctive} dozed by the radiator, and the JSON never started`,
          },),
        },);

        // BOTH HALVES MATTER. Node prints a refusal's message AND its stack, and
        // the message is the half V8 fills with the file's own text.
        expect(refusal.message.includes(distinctive,),).toBe(false,);
        expect((refusal.stack ?? '').includes(distinctive,),).toBe(false,);
      },
    },),
  ],
},);

//endregion Run JSON read tests
