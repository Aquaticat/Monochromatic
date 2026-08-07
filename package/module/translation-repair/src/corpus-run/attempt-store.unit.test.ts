/**
 * Tests for the persisted attempt map.
 *
 * `readAttemptMap` had no test. It backs the last ordering tiebreak, so an
 * entry that keeps failing deprioritizes instead of blocking the queue ahead of
 * entries that would settle.
 *
 * Its doctrine is the OPPOSITE of the artifact guards, deliberately: those
 * throw on anything malformed because they feed a precision measurement, while
 * this tolerates a corrupt cache because losing an ordering hint is cheaper
 * than aborting a run that costs hours. The cases below pin where tolerance
 * stops, since a reader that swallowed everything would make a misconfigured
 * path look like "no attempts yet" forever and the ordering would never
 * deprioritize anything.
 *
 * Fixtures are cat-themed invention written into throwaway directories.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { readAttemptMap, } from '../../dist/final/node/index.mjs';

/**
 * Throwaway directory holding one case's attempts file, removed on scope exit.
 *
 * @returns Disposable directory handle
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-attempts-',
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch() {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Writes an attempts file and reads it back.
 *
 * @param directory - throwaway directory
 *
 * @param contents - exact file bytes, so malformed cases stay malformed
 *
 * @param name - file name, so cases sharing a directory never share a file
 *
 * @returns Parsed attempt map
 *
 * @example
 * ```ts
 * const attempts = await readWritten({ directory, contents: '{"Kitten":2}', },);
 * ```
 */
async function readWritten(
  {
    directory,
    contents,
    name = 'attempts.json',
  }: {
    readonly directory: string;
    readonly contents: string;
    readonly name?: string;
  },
): Promise<Record<string, number>> {
  /**
   * Path the attempts file occupies.
   */
  const attemptsPath = join(
    directory,
    name,
  );
  await writeFile(
    attemptsPath,
    contents,
    'utf8',
  );
  return await readAttemptMap(attemptsPath,);
}

await describe({
  name: readAttemptMap.name,
  children: [
    it({
      name: 'reads a well-formed map through unchanged, which is the ordinary '
        + 'case the ordering depends on',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          await readWritten({
            directory: scratch.path,
            contents: JSON.stringify({
              Mittens: 2,
              Marmalade: 5,
            },),
          },),
        ).toStrictEqual({
          Mittens: 2,
          Marmalade: 5,
        },);
      },
    },),

    it({
      name: 'returns an empty map when the file is ABSENT, since a first run '
        + 'has no attempts recorded and that is not an error',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          await readAttemptMap(join(
            scratch.path,
            'never-written.json',
          ),),
        ).toStrictEqual({},);
      },
    },),

    it({
      name: 'returns an empty map for MALFORMED JSON rather than aborting, '
        + 'because a truncated write from an interrupted run costs an ordering '
        + 'hint and must not cost the run itself',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          await readWritten({
            directory: scratch.path,
            contents: '{"Mittens": 2,',
          },),
        ).toStrictEqual({},);
      },
    },),

    it({
      name: 'returns an empty map for well-formed JSON that is not an object, '
        + 'so a file holding a bare number or string cannot become an ordering '
        + 'input',
      fn: async () => {
        await using scratch = await scratchDir();

        // Each case writes its own file, so they share no state and run
        // concurrently rather than sequentially.
        const maps = await Promise.all([
          '42',
          '"Mittens"',
          'null',
          'true',
        ].map(async function toMap(contents, index,) {
          return await readWritten({
            directory: scratch.path,
            contents,
            name: `not-an-object-${String(index,)}.json`,
          },);
        },),);

        for (const map of maps)
          expect(map,).toStrictEqual({},);
      },
    },),

    it({
      name: 'COERCES a non-numeric count to zero rather than dropping the '
        + 'entry, keeping every recorded id in the map. Zero means fewest '
        + 'attempts, so a corrupted count makes that entry sort first, which '
        + 'is the tolerant direction: it retries an entry rather than starving '
        + 'it',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          await readWritten({
            directory: scratch.path,
            contents: JSON.stringify({
              Mittens: 'many',
              Marmalade: 5,
            },),
          },),
        ).toStrictEqual({
          Mittens: 0,
          Marmalade: 5,
        },);
      },
    },),

    it({
      name: 'THROWS on a read fault that is neither absence nor malformed '
        + 'JSON. Pointing the path at a directory is the shape a misconfigured '
        + 'runs directory produces, and swallowing it would make every run '
        + 'read "no attempts yet" forever, so the ordering would never '
        + 'deprioritize an entry that keeps failing',
      fn: async () => {
        await using scratch = await scratchDir();

        await expect(readAttemptMap(scratch.path,),).rejects.toThrow();
      },
    },),

    it({
      name: 'reads an empty object as an empty map, distinguishing a run that '
        + 'recorded nothing from a file that was never written, both of which '
        + 'are legitimate',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          await readWritten({
            directory: scratch.path,
            contents: '{}',
          },),
        ).toStrictEqual({},);
      },
    },),
  ],
},);
