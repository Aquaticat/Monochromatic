/**
 Tests for the persisted attempt map.
 
 `readAttemptMap` had no test. It backs the last ordering tiebreak, so an
 entry that keeps failing deprioritizes instead of blocking the queue ahead of
 entries that would settle.
 
 Its doctrine is the OPPOSITE of the artifact guards, deliberately: those
 throw on anything malformed because they feed a precision measurement, while
 this tolerates a corrupt cache because losing an ordering hint is cheaper
 than aborting a run that costs hours. The cases in this file pin where tolerance
 stops, since a reader that swallowed everything would make a misconfigured
 path look like "no attempts yet" forever and the ordering would never
 deprioritize anything.
 
 Fixtures are cat-themed invention written into throwaway directories.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  attemptsOf,
  countAttempt,
  readAttemptMap,
  writeAttemptMap,
} from '../../dist/final/node/index.mjs';

/**
 Throwaway directory holding one case's attempts file, removed on scope exit.
 
 @returns Disposable directory handle
 
 @example
 ```ts
 await using scratch = await scratchDir();
 ```
 */
async function scratchDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   Fresh directory under the platform temp root.
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
 Writes an attempts file and reads it back.
 
 @param directory - throwaway directory
 
 @param contents - exact file bytes, so malformed cases stay malformed
 
 @param name - file name, so cases sharing a directory never share a file
 
 @returns Parsed attempt map
 
 @example
 ```ts
 const attempts = await readWritten({ directory, contents: '{"Kitten":2}', },);
 ```
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
   Path the attempts file occupies.
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

/**
 Reads one attempts file while `console.warn`, where the tagged logger's
 `warn` sink resolves, is diverted into a list.

 @param contents - exact file bytes

 @returns Warnings the read printed

 @example
 ```ts
 const warned = await warningsReading({ contents: '{"Kitten":', },);
 ```
 */
async function warningsReading(
  { contents, }: { readonly contents: string; },
): Promise<readonly string[]> {
  await using scratch = await scratchDir();
  /**
   Warnings the read printed.
   */
  const lines: string[] = [];
  /**
   `console.warn` as it was, put back once the read returns.
   */
  const warned = console.warn;
  console.warn = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  await using restore = {
    [Symbol.asyncDispose]: async () => {
      console.warn = warned;
    },
  };
  await readWritten({
    directory: scratch.path,
    contents,
  },);
  return lines;
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

await describe({
  name: 'readAttemptMap announcements',
  // SEQUENTIAL: each case diverts the one global `console.warn` across an
  // await, and concurrent cases would capture each other's lines.
  concurrency: 1,
  children: [
    it({
      name: 'SAYS it starts the counts over for malformed JSON and for JSON that is no object, and names a '
        + 'count it read as zero, since each silently forgets which entries kept failing (ledger A11)',
      fn: async () => {
        expect((await warningsReading({ contents: '{"Mittens": 2,', },)).length,).toBe(1,);
        expect((await warningsReading({ contents: '42', },)).length,).toBe(1,);

        /**
         Warnings for a count that is no number.
         */
        const coerced = await warningsReading({
          contents: JSON.stringify({
            Mittens: 'many',
            Marmalade: 5,
          },),
        },);
        expect(coerced.length,).toBe(1,);
        expect(coerced[0],).toContain('Mittens',);
      },
    },),
    it({
      name: 'STAYS QUIET for a well-formed map, so the warnings the "SAYS it starts the counts over" case '
        + 'reads are worth reading',
      fn: async () => {
        expect(await warningsReading({ contents: '{"Mittens": 2}', },),).toStrictEqual([],);
      },
    },),
  ],
},);

await describe({
  name: writeAttemptMap.name,
  children: [
    it({
      name: 'WRITES a map the reader reads back whole, leaving no partial file beside it',
      fn: async () => {
        await using scratch = await scratchDir();
        /**
         Path the attempts file occupies.
         */
        const attemptsPath = join(
          scratch.path,
          'attempts.json',
        );
        await writeAttemptMap({
          attemptsPath,
          attempts: {
            Mittens: 2,
            Marmalade: 5,
          },
        },);
        expect(await readAttemptMap(attemptsPath,),).toStrictEqual({
          Mittens: 2,
          Marmalade: 5,
        },);
        expect(await readdir(scratch.path,),).toStrictEqual(['attempts.json',],);
      },
    },),
  ],
},);

await describe({
  name: `${attemptsOf.name} and ${countAttempt.name} (ledger B77)`,
  children: [
    it({
      name: 'COUNTS NO ATTEMPT for an entry whose id is a name every object inherits, where a plain-object '
        + 'map answered with the inherited function or object as the count',
      fn: async () => {
        await using scratch = await scratchDir();
        /**
         Counts read from a file that records none.
         */
        const attempts = await readWritten({
          directory: scratch.path,
          contents: '{}',
        },);
        expect([
          'constructor',
          '__proto__',
          'toString',
        ].map(function countOf(id,): number {
          return attemptsOf({
            attempts,
            id,
          },);
        },),).toStrictEqual([0, 0, 0,],);
      },
    },),

    it({
      name: 'COUNTS AND WRITES an attempt for an entry whose id is __proto__, where a plain-object map took the '
        + 'count as setting its prototype and dropped it, so the entry sorted as never tried',
      fn: async () => {
        await using scratch = await scratchDir();
        /**
         Path the attempts file occupies.
         */
        const attemptsPath = join(
          scratch.path,
          'attempts.json',
        );
        await writeFile(
          attemptsPath,
          '{}',
          'utf8',
        );
        /**
         Counts this case adds to.
         */
        const attempts = await readAttemptMap(attemptsPath,);
        countAttempt({
          attempts,
          id: '__proto__',
        },);
        expect(attemptsOf({
          attempts,
          id: '__proto__',
        },),).toBe(1,);
        await writeAttemptMap({
          attemptsPath,
          attempts,
        },);
        expect(attemptsOf({
          attempts: await readAttemptMap(attemptsPath,),
          id: '__proto__',
        },),).toBe(1,);
      },
    },),

    it({
      name: 'READS BACK a count a file records for an entry whose id is __proto__, which the file holds as a '
        + 'field of its own',
      fn: async () => {
        await using scratch = await scratchDir();
        expect(attemptsOf({
          attempts: await readWritten({
            directory: scratch.path,
            contents: '{"__proto__": 2}',
          },),
          id: '__proto__',
        },),).toBe(2,);
      },
    },),
  ],
},);
