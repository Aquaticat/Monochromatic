/**
 Tests for how the coverage census splits a build's bundles by their source
 maps (ledger T8). A bundle of import and export statements alone gets no
 map from rolldown, as the package's `index.mjs` has since 2026-09-29, and
 the census refused the whole build over it; a build with no map at all is
 the normal build, which the census still refuses. Names are cat-themed
 invention.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  bundleMapsOf,
  requireMapFor,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 Build directory the refusals name.
 */
const DIST = '/cats/dist/final/node';

await describe({
  name: bundleMapsOf.name,
  children: [
    it({
      name: 'SPLITS the bundles by the map beside each, sorted, and reads nothing but .mjs files as bundles',
      fn: async () => {
        expect(bundleMapsOf({
          built: [
            'purr.mjs',
            'purr.mjs.map',
            'index.mjs',
            'index.d.mts',
            'nap.mjs.map',
            'nap.mjs',
            'litter.mjs.map',
            'notes.txt',
          ],
          distDirectory: DIST,
        },),).toEqual({
          mapped: ['nap.mjs', 'purr.mjs',],
          unmapped: ['index.mjs',],
        },);
      },
    },),
    it({
      name: 'REFUSES a build with no map beside any bundle, naming the directory and the bundle count: the '
        + 'normal build',
      fn: async () => {
        /**
         What the split threw on a build without maps.
         */
        const refusal = caught(function normalBuild(): void {
          bundleMapsOf({
            built: ['nap.mjs', 'index.mjs', 'index.d.mts',],
            distDirectory: DIST,
          },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(`${DIST} holds 2 bundles and no source map`,);
      },
    },),
    it({
      name: 'REFUSES a build that holds no bundle at all',
      fn: async () => {
        /**
         What the split threw on an empty build.
         */
        const refusal = caught(function emptyBuild(): void {
          bundleMapsOf({
            built: [],
            distDirectory: DIST,
          },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(`${DIST} holds 0 bundles`,);
      },
    },),
  ],
},);

await describe({
  name: requireMapFor.name,
  children: [
    it({
      name: 'PASSES a bundle with a map, for either need',
      fn: async () => {
        expect(requireMapFor({
          bundle: 'nap.mjs',
          need: 'cold-code',
          unmapped: ['index.mjs',],
          distDirectory: DIST,
        },),).toBeUndefined();
        expect(requireMapFor({
          bundle: 'nap.mjs',
          need: 'unloaded-sources',
          unmapped: ['index.mjs',],
          distDirectory: DIST,
        },),).toBeUndefined();
      },
    },),
    it({
      name: 'REFUSES code no test ran in a bundle with no map, naming the bundle and what cannot be placed',
      fn: async () => {
        /**
         What the check threw for cold code in an unmapped bundle.
         */
        const refusal = caught(function coldUnmapped(): void {
          requireMapFor({
            bundle: 'index.mjs',
            need: 'cold-code',
            unmapped: ['index.mjs',],
            distDirectory: DIST,
          },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain('coverage finds code no test ran in index.mjs',);
        expect((refusal as Error).message,).toContain('cannot place that code on a source line',);
      },
    },),
    it({
      name: 'REFUSES a bundle no test loaded with no map, naming the bundle and the sources it cannot name',
      fn: async () => {
        /**
         What the check threw for an unloaded unmapped bundle.
         */
        const refusal = caught(function unloadedUnmapped(): void {
          requireMapFor({
            bundle: 'index.mjs',
            need: 'unloaded-sources',
            unmapped: ['index.mjs',],
            distDirectory: DIST,
          },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain('no test loaded index.mjs',);
        expect((refusal as Error).message,).toContain('cannot say which sources it carries',);
      },
    },),
  ],
},);
