import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isPackageManifest,
  shippingTargets,
  stringTargets,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'package manifest reading',
  children: [
    describe({
      name: isPackageManifest.name,
      children: [
        it({
          name: 'accepts an object carrying a string name',
          fn: async () => {
            expect(isPackageManifest({ name: '@scope/pkg', },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects null',
          fn: async () => {
            expect(isPackageManifest(null,),).toBe(false,);
          },
        },),
        it({
          name: 'rejects a non-object',
          fn: async () => {
            expect(isPackageManifest('@scope/pkg',),).toBe(false,);
          },
        },),
        it({
          name: 'rejects a manifest with no name, so the ancestor walk continues',
          fn: async () => {
            expect(isPackageManifest({ version: '1.0.0', },),).toBe(false,);
          },
        },),
        it({
          name: 'rejects a non-string name',
          fn: async () => {
            expect(isPackageManifest({ name: 42, },),).toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: stringTargets.name,
      children: [
        it({
          name: 'returns a bare string target',
          fn: async () => {
            expect(stringTargets({ node: './dist/final/node/index.mjs', },),)
              .toEqual(['./dist/final/node/index.mjs',],);
          },
        },),
        it({
          name: 'returns nothing for an absent field',
          fn: async () => {
            expect(stringTargets({ node: undefined, },),).toEqual([],);
          },
        },),
        it({
          name: 'returns nothing for a blocked subpath',
          fn: async () => {
            expect(stringTargets({ node: null, },),).toEqual([],);
          },
        },),
        it({
          name: 'flattens a condition object',
          fn: async () => {
            expect(stringTargets({
              node: {
                types: './a.d.mts',
                default: './a.mjs',
              },
            },).toSorted(),).toEqual([
              './a.d.mts',
              './a.mjs',
            ],);
          },
        },),
        it({
          name: 'flattens an array of fallbacks',
          fn: async () => {
            expect(stringTargets({
              node: [
                './a.mjs',
                './b.mjs',
              ],
            },).toSorted(),).toEqual([
              './a.mjs',
              './b.mjs',
            ],);
          },
        },),
        it({
          name: 'flattens nested conditions to arbitrary depth',
          fn: async () => {
            expect(stringTargets({
              node: {
                node: {
                  import: { default: './deep.mjs', },
                },
              },
            },),).toEqual(['./deep.mjs',],);
          },
        },),
      ],
    },),

    describe({
      name: shippingTargets.name,
      children: [
        it({
          name: 'skips the source subpath keys',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                exports: {
                  '.': './dist/final/node/index.mjs',
                  './ts': './src/index.ts',
                  './ts/*': './src/*',
                },
              },
            },),).toEqual(['./dist/final/node/index.mjs',],);
          },
        },),
        it({
          name: 'reads a condition-map shorthand with no subpath keys',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                exports: {
                  types: './dist/final/node/index.d.mts',
                  default: './dist/final/node/index.mjs',
                },
              },
            },).toSorted(),).toEqual([
              './dist/final/node/index.d.mts',
              './dist/final/node/index.mjs',
            ],);
          },
        },),
        it({
          name: 'reads a bare string exports field',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                exports: './dist/final/node/index.mjs',
              },
            },),).toEqual(['./dist/final/node/index.mjs',],);
          },
        },),
        it({
          name: 'reads main',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                main: 'dist/app/main.mjs',
              },
            },),).toEqual(['dist/app/main.mjs',],);
          },
        },),
        it({
          name: 'reads a string bin',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                bin: './dist/final/node/cli.mjs',
              },
            },),).toEqual(['./dist/final/node/cli.mjs',],);
          },
        },),
        it({
          name: 'reads an object bin',
          fn: async () => {
            expect(shippingTargets({
              manifest: {
                name: '@scope/pkg',
                bin: { pkg: './dist/final/node/cli.mjs', },
              },
            },),).toEqual(['./dist/final/node/cli.mjs',],);
          },
        },),
        it({
          name: 'returns nothing when the manifest declares no entry at all',
          fn: async () => {
            expect(shippingTargets({ manifest: { name: '@scope/pkg', }, },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
