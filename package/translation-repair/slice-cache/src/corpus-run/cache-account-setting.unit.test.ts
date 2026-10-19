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

import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary';
import { cacheVersionSetting, } from '../../dist/final/node/index.mjs';
import {
  commitFileAt,
  makeCacheAccountRepo,
  moveFileAt,
} from './cache-account-repo.test-fixture.ts';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/corpus-run/rejection-of.test-fixture.ts';

/**
 The stage version at the value the history sets first.
 */
const STAGE_VERSION = {
  name: 'STAGE_CACHE_VERSION',
  value: 1,
  path: 'src/stage-cache-version.ts',
  declaration: 'STAGE_CACHE_VERSION = 1',
};

/**
 Where the translation-repair sources stood before the family was split out of them.
 */
const PRE_SPLIT_SOURCES = 'package/module/translation-repair/src';

/**
 Pathspec of every file under the sources of the family's packages, as the audit hands the lookup.
 */
const FAMILY_SOURCES = ':(glob)package/translation-repair/*/src/**';

/**
 The stage version as the split left it: declared in a package of the family.
 */
const SPLIT_STAGE_VERSION = {
  ...STAGE_VERSION,
  path: 'package/translation-repair/stage/src/stage-cache-version.ts',
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
      name: 'FINDS THE COMMIT THAT SET A VERSION BEFORE THE SPLIT, not the commit that moved the file into the '
        + 'family, since a move sets nothing',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'none', },);
        const setBeforeSplit = await commitFileAt({
          cloneDir: repo.path,
          day: 5,
          path: `${PRE_SPLIT_SOURCES}/stage-cache-version.ts`,
          text: 'export const STAGE_CACHE_VERSION = 1;\n',
          subject: 'set the stage cache version',
        },);
        await moveFileAt({
          cloneDir: repo.path,
          day: 6,
          from: `${PRE_SPLIT_SOURCES}/stage-cache-version.ts`,
          to: SPLIT_STAGE_VERSION.path,
          subject: 'split the translation-repair package',
        },);

        expect(await cacheVersionSetting({
          root: repo.path,
          sources: FAMILY_SOURCES,
          version: SPLIT_STAGE_VERSION,
        },),).toEqual(setBeforeSplit,);
      },
    },),
    it({
      name: 'FINDS THE MOVE AS THE SETTING where the package stands outside the family, whose sources never stood '
        + 'at the pre-split path',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'none', },);
        await commitFileAt({
          cloneDir: repo.path,
          day: 5,
          path: `${PRE_SPLIT_SOURCES}/stage-cache-version.ts`,
          text: 'export const STAGE_CACHE_VERSION = 1;\n',
          subject: 'set the stage cache version',
        },);
        const moved = await moveFileAt({
          cloneDir: repo.path,
          day: 6,
          from: `${PRE_SPLIT_SOURCES}/stage-cache-version.ts`,
          to: 'package/stray/src/stage-cache-version.ts',
          subject: 'move the stage cache version to the stray package',
        },);

        expect(await cacheVersionSetting({
          root: repo.path,
          sources: 'package/stray/src',
          version: {
            ...STAGE_VERSION,
            path: 'package/stray/src/stage-cache-version.ts',
          },
        },),).toEqual(moved,);
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
