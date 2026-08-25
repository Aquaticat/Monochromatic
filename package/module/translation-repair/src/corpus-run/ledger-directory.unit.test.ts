/**
 * Tests for reading a run's ledger directory without raising on a bad file.
 *
 * THE PARTITION IS WHAT THESE CHECK. A directory holding one good file beside
 * two unreadable ones is the case the reader exists for, and a reader that threw
 * on the first refusal would answer nothing about the rest while looking exactly
 * like a run that recorded nothing.
 *
 * ORDER IS CHECKED TOO. Files are named by a zero-padded ordinal and that
 * ordering is contest order, so a reader that partitioned correctly but lost the
 * sequence would still misreport which contest came first.
 *
 * THE REFUSAL TEXT IS CHECKED FOR WHAT IT DOES NOT SAY. A ledger file holds
 * corpus wording, so a refusal that forwarded a foreign class's message could
 * carry a passage into a log.
 *
 * Model identifiers are cat-themed invention rather than catalog entries here,
 * because nothing in this file judges a seat; passages are invention too, so no
 * corpus content appears.
 *
 * @module
 */

import {
  mkdir,
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
  LedgerShapeError,
  readLedgerDirectory,
  refusalOf,
  RunJsonUnreadableError,
} from '../../dist/final/node/index.mjs';

//region Ledger directory tests

/**
 * One contest, written the way the recorder writes them.
 */
const ONE_ROUND = JSON.stringify({
  task: 'whiskerfield-0',
  at: '2026-08-25T00:00:00.000Z',
  candidates: [
    {
      index: 0,
      producers: ['tabby-writer-1',],
      rendered: 'Biscuit slept on the warm sill.',
    },
  ],
  ballots: [
    {
      modelId: 'mittens-judge-3',
      best: 1,
      reason: 'it keeps the sill',
    },
  ],
  selectedIndex: 0,
},);

/**
 * Builds a disposable ledger directory holding exactly these files.
 *
 * ON A THROWAWAY, never a run directory: these cases write malformed files on
 * purpose, and a real ledger is what the reader is protecting.
 *
 * @param files - file names mapped to their exact bytes
 *
 * @returns Ledger directory the case should read
 *
 * @example
 * ```ts
 * const dir = await ledgerOf({ files: { '000001.json': ONE_ROUND, }, },);
 * ```
 */
async function ledgerOf(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const root = await mkdtemp(join(
    tmpdir(),
    'ledger-directory-',
  ),);

  /**
   * Where the files land.
   */
  const dir = join(
    root,
    'ledger',
  );

  await mkdir(dir,);
  await Promise.all(Object.entries(files,)
    .map(async function writeOne([name, text,],): Promise<void> {
      await writeFile(
        join(
          dir,
          name,
        ),
        text,
        'utf8',
      );
    },),);

  return dir;
}

await describe({
  name: readLedgerDirectory.name,
  children: [
    it({
      name: 'READS an absent directory as empty rather than raising, since a run may have written none',
      fn: async () => {
        /**
         * Reading of a directory that was never created.
         */
        const reading = await readLedgerDirectory({
          dir: join(
            await mkdtemp(join(
              tmpdir(),
              'ledger-directory-',
            ),),
            'ledger',
          ),
        },);

        expect(reading.rounds.length,).toBe(0,);
        expect(reading.refused.length,).toBe(0,);
      },
    },),
    it({
      name: 'READS a clean directory with nothing refused',
      fn: async () => {
        /**
         * Reading of two well-formed contests.
         */
        const reading = await readLedgerDirectory({
          dir: await ledgerOf({
            files: {
              '000001.json': ONE_ROUND,
              '000002.json': ONE_ROUND,
            },
          },),
        },);

        expect(reading.rounds.length,).toBe(2,);
        expect(reading.refused.length,).toBe(0,);
      },
    },),
    it({
      name: 'READS EVERY FILE past a refusal, so one bad file costs only itself',
      fn: async () => {
        /**
         * Reading of a good file sitting between two unreadable ones, so a
         * reader that stopped at the first refusal would report zero contests
         * and a reader that stopped at the last would report one refusal.
         */
        const reading = await readLedgerDirectory({
          dir: await ledgerOf({
            files: {
              '000001.json': '{"task":"whiskerfield-1",',
              '000002.json': ONE_ROUND,
              '000003.json': 'Bixbyfluff dozed here and wrote no JSON',
            },
          },),
        },);

        expect(reading.rounds.length,).toBe(1,);
        expect(reading.refused.map(function named(refusal,): string {
          return refusal.file;
        },),).toEqual([
          '000001.json',
          '000003.json',
        ],);
      },
    },),
    it({
      name: 'REFUSES well-formed JSON that is not a contest, naming the field rather than the value',
      fn: async () => {
        /**
         * Reading of a file that parses but holds no contest.
         */
        const reading = await readLedgerDirectory({
          dir: await ledgerOf({
            files: { '000001.json': '{"cat":"Bixbyfluff"}', },
          },),
        },);

        expect(reading.rounds.length,).toBe(0,);
        expect(reading.refused.length,).toBe(1,);
        expect((reading.refused[0]?.says ?? '').includes('task',),).toBe(true,);
        expect((reading.refused[0]?.says ?? '').includes('Bixbyfluff',),).toBe(false,);
      },
    },),
    it({
      name: 'KEEPS contest order, which is the order the recorder stamped',
      fn: async () => {
        /**
         * Reading whose files were written out of order on disk.
         */
        const reading = await readLedgerDirectory({
          dir: await ledgerOf({
            files: {
              '000003.json': ONE_ROUND.replace(
                'whiskerfield-0',
                'whiskerfield-3',
              ),
              '000001.json': ONE_ROUND.replace(
                'whiskerfield-0',
                'whiskerfield-1',
              ),
              '000002.json': ONE_ROUND.replace(
                'whiskerfield-0',
                'whiskerfield-2',
              ),
            },
          },),
        },);

        expect(reading.rounds.map(function task(round,): string {
          return round.task;
        },),).toEqual([
          'whiskerfield-1',
          'whiskerfield-2',
          'whiskerfield-3',
        ],);
      },
    },),
  ],
},);

await describe({
  name: refusalOf.name,
  children: [
    it({
      name: 'FORWARDS a RunJsonUnreadableError message, which is built to name rather than quote',
      fn: async () => {
        expect(refusalOf({
          error: new RunJsonUnreadableError({
            file: '000001.json',
            failure: 'SyntaxError',
            at: 27,
          },),
          file: '000001.json',
        },).says,).toBe('could not read 000001.json as JSON (SyntaxError at byte 27)',);
      },
    },),
    it({
      name: 'FORWARDS a LedgerShapeError message, which names a file and a field and no value',
      fn: async () => {
        expect(refusalOf({
          error: new LedgerShapeError({
            from: '000001.json',
            field: 'ballots',
          },),
          file: '000001.json',
        },).says,).toBe('ledger file 000001.json has no usable ballots',);
      },
    },),
    it({
      name: 'REFUSES to forward a foreign message, naming only the class',
      fn: async () => {
        /**
         * Wording a foreign error carries, which must not reach the report.
         *
         * A CLASS FROM OUTSIDE THIS PACKAGE writes whatever it likes into its
         * message, and a run directory is full of text nobody here chose. The
         * two cases above pass a message through BECAUSE those two classes
         * promise not to quote; this one proves the promise is what earns it.
         */
        const { says, } = refusalOf({
          error: new RangeError('Bixbyfluff dozed by the radiator',),
          file: '000001.json',
        },);

        expect(says,).toBe('refused by RangeError',);
        expect(says.includes('Bixbyfluff',),).toBe(false,);
      },
    },),
    it({
      name: 'NAMES a thrown value that is not an Error at all',
      fn: async () => {
        expect(refusalOf({
          error: 'Bixbyfluff',
          file: '000001.json',
        },).says,).toBe('refused by a thrown value that is not an Error',);
      },
    },),
  ],
},);

//endregion Ledger directory tests
