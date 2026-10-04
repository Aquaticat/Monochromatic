/**
 Tests for the slice cache's resume read: what recomputes and what surfaces.

 A HALF-WRITTEN FILE IS RECOMPUTED AND SAID (ledger A11), since the slice is
 bought again either way; any other fault surfaces, since persisting is atomic
 now and a file that will not read under that is a fault worth seeing.

 FIXTURES ARE CAT-THEMED, over a throwaway cache directory.

 @module
 */

import { chmod, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  loadNamespacedSlices,
  REPAIR_SLICE_NAMESPACE,
  sliceFileName,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

//region Slice cache resume tests

await describe({
  name: loadNamespacedSlices.name,
  children: [
    it({
      name: 'RECOMPUTES a cache file whose JSON is no record, and SURFACES the fault where the file will '
        + 'not read',
      fn: async () => {
        // Cache directory holding one file whose JSON is a number and one
        // the process may not read.
        await using dir = await scratchDir({ prefix: 'slice-cache-namespace-', },);
        await writeFile(
          join(dir.path, sliceFileName({ key: 'k1', namespace: REPAIR_SLICE_NAMESPACE, },),),
          '5',
          'utf8',
        );
        const loaded = await loadNamespacedSlices({
          dir: dir.path,
          namespace: REPAIR_SLICE_NAMESPACE,
          isValue: function isText(value: unknown,): value is string {
            return (typeof value) === 'string';
          },
        },);
        expect(loaded.size,).toBe(0,);

        await writeFile(
          join(dir.path, sliceFileName({ key: 'k2', namespace: REPAIR_SLICE_NAMESPACE, },),),
          '5',
          'utf8',
        );
        await chmod(
          join(dir.path, sliceFileName({ key: 'k2', namespace: REPAIR_SLICE_NAMESPACE, },),),
          0o000,
        );
        await expect(loadNamespacedSlices({
          dir: dir.path,
          namespace: REPAIR_SLICE_NAMESPACE,
          isValue: function isText(value: unknown,): value is string {
            return (typeof value) === 'string';
          },
        },),).rejects.toThrow();
      },
    },),
  ],
},);

//endregion Slice cache resume tests
