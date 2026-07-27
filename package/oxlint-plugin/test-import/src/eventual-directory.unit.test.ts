import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { eventualDirectories, } from '../dist/final/node/index.mjs';

/** Package root every case in this file derives directories against. */
const ROOT = '/repo/package/module/x';

/**
 * Computes eventual directories for one manifest, sorted for stable comparison.
 *
 * @param manifest - manifest fields under test
 *
 * @returns sorted normalized directories
 *
 * @example
 * ```ts
 * directoriesOf({ name: '@scope/pkg' });
 * ```
 */
function directoriesOf(manifest: Parameters<typeof eventualDirectories>[0]['manifest'],): readonly string[] {
  return eventualDirectories({
    packageRoot: ROOT,
    manifest,
  },)
    .toSorted();
}

await describe({
  name: eventualDirectories.name,
  children: [
    it({
      name: 'always includes the default artifact root, even with no entries declared',
      fn: async () => {
        expect(directoriesOf({ name: '@scope/pkg', },),).toEqual([`${ROOT}/dist/final`,],);
      },
    },),
    it({
      name: 'adds the directory holding a declared exports entry',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          exports: { '.': './dist/final/node/index.mjs', },
        },),).toEqual([
          `${ROOT}/dist/final`,
          `${ROOT}/dist/final/node`,
        ],);
      },
    },),
    it({
      name: 'adds a main entry directory outside the default root',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          main: 'dist/app/main.mjs',
        },),).toEqual([
          `${ROOT}/dist/app`,
          `${ROOT}/dist/final`,
        ],);
      },
    },),
    it({
      name: 'adds a bin entry directory',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          bin: { pkg: './dist/bin/cli.mjs', },
        },),).toEqual([
          `${ROOT}/dist/bin`,
          `${ROOT}/dist/final`,
        ],);
      },
    },),
    it({
      name: 'never counts the bare dist root, so intermediate output stays rejected',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          exports: { './font': './dist/Face-Regular.otf', },
        },),).toEqual([`${ROOT}/dist/final`,],);
      },
    },),
    it({
      name: 'discards entries pointing into source',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          main: './src/index.ts',
          bin: { pkg: './src/cli.ts', },
        },),).toEqual([`${ROOT}/dist/final`,],);
      },
    },),
    it({
      name: 'never counts the package root itself',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          main: './index.mjs',
        },),).toEqual([`${ROOT}/dist/final`,],);
      },
    },),
    it({
      name: 'skips the source subpath exports keys',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          exports: {
            './ts': './src/index.ts',
            './ts/*': './src/*',
          },
        },),).toEqual([`${ROOT}/dist/final`,],);
      },
    },),
    it({
      name: 'deduplicates entries resolving to one directory',
      fn: async () => {
        expect(directoriesOf({
          name: '@scope/pkg',
          exports: {
            '.': {
              types: './dist/final/node/index.d.mts',
              default: './dist/final/node/index.mjs',
            },
            './extra': './dist/final/node/extra.mjs',
          },
        },),).toEqual([
          `${ROOT}/dist/final`,
          `${ROOT}/dist/final/node`,
        ],);
      },
    },),
  ],
},);
