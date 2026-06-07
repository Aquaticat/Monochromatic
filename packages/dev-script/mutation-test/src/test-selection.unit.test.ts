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
      name: 'selects related sibling tests plus regression and integration tests by default',
      fn: async () => {
        const packageRoot = await fixturePackage();
        const selected = await selectTestsForSource({
          packageRoot,
          sourceFile: 'src/io/glob-mirror.ts',
          fullSuite: false,
        },);

        expect(selected,).toEqual([
          'src/integration.unit.test.ts',
          'src/io/glob.unit.test.ts',
          'src/watch-regression.unit.test.ts',
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

        expect(selected,).toHaveLength(5,);
        expect(selected,).toContain('src/watch/watch-filter.unit.test.ts',);
      },
    },),
  ],
},);
