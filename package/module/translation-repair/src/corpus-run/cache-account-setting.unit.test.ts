/**
 Tests for finding the commit that set a cache version's current value: the
 newest commit that added its declaration on balance, among those git's
 pickaxe names.

 Git runs inside a throwaway repository the cases build, so nothing reads this
 repository's history.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cacheVersionSetting,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import {
  commitFileAt,
  makeCacheAccountRepo,
} from './cache-account-repo.test-fixture.ts';
import { rejectionOf, } from './rejection-of.test-fixture.ts';

/**
 The stage version at the value the history sets first.
 */
const STAGE_VERSION = {
  name: 'STAGE_CACHE_VERSION',
  value: 1,
  path: 'src/stage-cache-version.ts',
  declaration: 'STAGE_CACHE_VERSION = 1',
};

await describe({
  name: cacheVersionSetting.name,
  children: [
    it({
      name: 'FINDS THE COMMIT THAT SET A VERSION, with its time and subject',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'one', },);

        expect(await cacheVersionSetting({
          root: repo.path,
          sources: 'src',
          version: STAGE_VERSION,
        },),).toEqual(repo.stageSet,);
      },
    },),
    it({
      name: 'FINDS THE NEWEST COMMIT THAT ADDED THE VALUE where it was set, changed and set back, since the oldest '
        + 'one git names set nothing that stands',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'one', },);
        await commitFileAt({
          cloneDir: repo.path,
          day: 5,
          path: 'src/stage-cache-version.ts',
          text: 'export const STAGE_CACHE_VERSION = 2;\n',
          subject: 'move the stage cache version',
        },);
        const setBack = await commitFileAt({
          cloneDir: repo.path,
          day: 6,
          path: 'src/stage-cache-version.ts',
          text: 'export const STAGE_CACHE_VERSION = 1;\n',
          subject: 'move the stage cache version back',
        },);

        expect(await cacheVersionSetting({
          root: repo.path,
          sources: 'src',
          version: STAGE_VERSION,
        },),).toEqual(setBack,);
      },
    },),
    it({
      name: 'REFUSES A VALUE NO COMMIT SETS as stated, naming the declaration and the file, so an uncommitted '
        + 'value is committed before the audit is read',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'one', },);

        /**
         What the lookup rejected with.
         */
        const refusal = await rejectionOf({
          promise: cacheVersionSetting({
            root: repo.path,
            sources: 'src',
            version: {
              ...STAGE_VERSION,
              value: 7,
              declaration: 'STAGE_CACHE_VERSION = 7',
            },
          },),
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect(String(refusal,),).toBe(
          'StatedRefusalError: STAGE_CACHE_VERSION = 7 in src/stage-cache-version.ts is not in any commit; '
          + 'commit it, then run the audit again.',
        );
      },
    },),
  ],
},);
