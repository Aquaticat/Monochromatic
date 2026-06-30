import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  selectTestsForSource,
  stemsAreRelated,
} from '../dist/final/node/index.mjs';

/**
 * Creates package test files for selection tests.
 *
 * @returns Temporary package root.
 *
 * @example
 * ```ts
 * await fixturePackage();
 * ```
 */
async function fixturePackage(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mutation-test-selection-',),);
  await mkdir(join(root, 'src', 'io',), { recursive: true, },);
  await mkdir(join(root, 'src', 'watch',), { recursive: true, },);
  await Promise.all([
    writeFile(join(root, 'src', 'io', 'glob.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'glob-regression.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'json.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'watch', 'watch-filter.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'watch-regression.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'integration.unit.test.ts',), 'export {};\n',),
  ],);
  return root;
}

await describe({
  name: stemsAreRelated.name,
  children: [
    it({
      name: 'matches exact and hyphen-prefix stems only',
      fn: async () => {
        expect(stemsAreRelated({ sourceStem: 'glob-mirror', testStem: 'glob', },),).toBe(true,);
        expect(stemsAreRelated({ sourceStem: 'glob', testStem: 'glob-mirror', },),).toBe(true,);
        expect(stemsAreRelated({ sourceStem: 'json', testStem: 'glob', },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: selectTestsForSource.name,
  children: [
    it({
      name: 'selects related sibling and regression tests plus integration tests by default',
      fn: async () => {
        const packageRoot = await fixturePackage();
        const selected = await selectTestsForSource({
          packageRoot,
          sourceFile: 'src/io/glob-mirror.ts',
          fullSuite: false,
        },);

        expect(selected,).toEqual([
          'src/integration.unit.test.ts',
          'src/io/glob-regression.unit.test.ts',
          'src/io/glob.unit.test.ts',
        ],);
      },
    },),
    it({
      name: 'selects every unit test in full-suite mode',
      fn: async () => {
        const packageRoot = await fixturePackage();
        const selected = await selectTestsForSource({
          packageRoot,
          sourceFile: 'src/io/glob-mirror.ts',
          fullSuite: true,
        },);

        expect(selected,).toHaveLength(6,);
        expect(selected,).toContain('src/watch/watch-filter.unit.test.ts',);
      },
    },),
  ],
},);

/**
 * Creates a package with sibling sidecars for sidecar-selection tests.
 *
 * Builds a dot-delimited fuzz sidecar (one unit test), a bench sidecar (no unit
 * test), and a hyphen-delimited sibling (a unit test that must not be matched).
 *
 * @returns Package root and the expected package-root-relative sidecar test path.
 *
 * @example
 * ```ts
 * await fixturePackageWithSidecar();
 * ```
 */
async function fixturePackageWithSidecar(): Promise<{
  readonly packageRoot: string;
  readonly sidecarTest: string;
}> {
  const parent = await mkdtemp(join(tmpdir(), 'mutation-test-sidecar-',),);
  const packageRoot = join(parent, 'jsonc-edit',);
  await Promise.all([
    mkdir(join(packageRoot, 'src',), { recursive: true, },),
    mkdir(join(parent, 'jsonc-edit.fuzz', 'src',), { recursive: true, },),
    mkdir(join(parent, 'jsonc-edit.bench', 'src',), { recursive: true, },),
    mkdir(join(parent, 'jsonc-edit-extra', 'src',), { recursive: true, },),
  ],);
  await Promise.all([
    writeFile(join(packageRoot, 'src', 'parse.unit.test.ts',), 'export {};\n',),
    writeFile(join(parent, 'jsonc-edit.fuzz', 'src', 'round-trip.property.unit.test.ts',), 'export {};\n',),
    writeFile(join(parent, 'jsonc-edit.bench', 'src', 'parse.bench.ts',), 'export {};\n',),
    writeFile(join(parent, 'jsonc-edit-extra', 'src', 'extra.unit.test.ts',), 'export {};\n',),
  ],);
  return {
    packageRoot,
    sidecarTest: '../jsonc-edit.fuzz/src/round-trip.property.unit.test.ts',
  };
}

await describe({
  name: selectTestsForSource.name,
  children: [
    it({
      name: 'includes dot-delimited sidecar unit tests, excluding bench-only and hyphen siblings',
      fn: async () => {
        const { packageRoot, sidecarTest, } = await fixturePackageWithSidecar();
        const selected = await selectTestsForSource({
          packageRoot,
          sourceFile: 'src/parse.ts',
          fullSuite: true,
        },);

        expect(selected,).toEqual([
          sidecarTest,
          'src/parse.unit.test.ts',
        ],);
      },
    },),
  ],
},);
