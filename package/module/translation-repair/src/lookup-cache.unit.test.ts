/**
 Tests for the lookup cache's guards and its read.

 A CACHE FILE THAT IS NO RECORD IS IGNORED, not refused: a stale or hand-made
 cache costs a lookup, not a run.

 FIXTURES ARE CAT-THEMED, over a throwaway cache file.

 @module
 */

import { mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isLookupHit,
  isLookupRecord,
  lookupCachePath,
  readCachedLookup,
} from '../dist/final/node/index.mjs';

//region Lookup cache tests

await describe({
  name: 'lookup cache guards',
  children: [
    it({
      name: 'READS NO HIT and NO RECORD where the parsed value is no object, and IGNORES a cache file that is no record',
      fn: async () => {
        expect(isLookupHit(5,),).toBe(false,);
        expect(isLookupRecord(5,),).toBe(false,);

        // A cache file whose JSON is no record.
        const dir = await mkdtemp(join(tmpdir(), 'lookup-cache-',),);
        const path = lookupCachePath({ dir, query: 'cat', },);
        await writeFile(path, '5', 'utf8',);
        const read = await readCachedLookup({ dir, query: 'cat', },);
        expect(read.kind,).toBe('miss',);
      },
    },),
  ],
},);

//endregion Lookup cache tests
