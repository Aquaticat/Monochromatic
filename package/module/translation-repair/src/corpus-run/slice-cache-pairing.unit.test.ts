/**
 Tests for the block and section pairing caches, which store one shape and
 share one validator (audit area six, ledger B18): a record round-trips
 through each, and a record whose findings are not all text, or a bare list,
 is never resumed. Fixtures are cat-themed invention written into throwaway
 directories.

 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  openPairingCache,
  openSectionPairingCache,
} from '../../dist/final/node/index.mjs';

/**
 Built pipeline the fixtures are filled under.
 */
const TEST_GENERATION = `sha256-tree-v1:${'b'.repeat(64,)}`;

/**
 Both pairing caches, named for the test output.
 */
const OPENERS = [
  {
    name: 'block',
    open: openPairingCache,
  },
  {
    name: 'section',
    open: openSectionPairingCache,
  },
] as const;

/**
 Throwaway directory removed on scope exit.

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
    'whiskers-pairing-cache-',
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
 Keys each cache resumes after one value is persisted under `paws` and the
 cache is opened again.

 @param dir - entry cache directory

 @param serialized - stored value

 @returns Resumed keys, per cache

 @example
 ```ts
 const resumed = await resumedAfter({ dir, serialized: '[]', },);
 ```
 */
async function resumedAfter(
  {
    dir,
    serialized,
  }: {
    readonly dir: string;
    readonly serialized: string;
  },
): Promise<readonly (readonly string[])[]> {
  return await Promise.all(OPENERS.map(async function roundTrip({ name, open, },): Promise<readonly string[]> {
    /**
     Directory of this cache's own case.
     */
    const caseDir = join(
      dir,
      name,
    );
    await (await open({
      dir: caseDir,
      generation: TEST_GENERATION,
    },)).persist({
      key: 'paws',
      serialized,
    },);
    return [...(await open({
      dir: caseDir,
      generation: TEST_GENERATION,
    },)).resumed.keys(),];
  },),);
}

await describe({
  name: 'pairing caches',
  children: [
    it({
      name: 'ROUND-TRIPS a pairing record through the block and the section cache',
      fn: async () => {
        await using scratch = await scratchDir();
        expect(await resumedAfter({
          dir: scratch.path,
          serialized: JSON.stringify({
            pairs: [{
              source: 0,
              target: 1,
            },],
            findings: ['the cat napped',],
          },),
        },),).toEqual([['paws',], ['paws',],],);
      },
    },),
    it({
      name: 'NEVER RESUMES a record whose findings are not all text, which both record types promise, nor one '
        + 'whose pairs are not index pairs, nor a bare list, in either cache (ledger B18: the copies checked only '
        + 'that findings were a list)',
      fn: async () => {
        await using scratch = await scratchDir();
        expect(await resumedAfter({
          dir: join(
            scratch.path,
            'numbers',
          ),
          serialized: JSON.stringify({
            pairs: [],
            findings: [7,],
          },),
        },),).toEqual([[], [],],);
        expect(await resumedAfter({
          dir: join(
            scratch.path,
            'pairs',
          ),
          serialized: JSON.stringify({
            pairs: [{
              source: 'the first block',
              target: 1,
            },],
            findings: [],
          },),
        },),).toEqual([[], [],],);
        expect(await resumedAfter({
          dir: join(
            scratch.path,
            'bare',
          ),
          serialized: JSON.stringify([],),
        },),).toEqual([[], [],],);
      },
    },),
  ],
},);
