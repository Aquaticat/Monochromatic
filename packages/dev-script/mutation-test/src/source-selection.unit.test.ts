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

import { enumerateSourceFiles, } from '../dist/final/node/index.mjs';

/**
 * Creates a temporary package with representative source and non-source files.
 *
 * @returns Temporary package root.
 *
 * @example
 * ```ts
 * await fixturePackage();
 * ```
 */
async function fixturePackage(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mutation-source-selection-',),);
  await mkdir(join(root, 'src', 'io',), { recursive: true, },);
  await mkdir(join(root, 'src', 'fixtures',), { recursive: true, },);
  await Promise.all([
    writeFile(join(root, 'src', 'index.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'glob.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'glob.unit.test.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'glob.spec.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'io', 'glob.d.ts',), 'export {};\n',),
    writeFile(join(root, 'src', 'fixtures', 'sample.ts',), 'export {};\n',),
  ],);
  return root;
}

await describe({
  name: enumerateSourceFiles.name,
  children: [
    it({
      name: 'selects production TypeScript files and documents exclusions',
      fn: async () => {
        const packageRoot = await fixturePackage();
        const selection = await enumerateSourceFiles({ packageRoot, },);

        expect(selection.files,).toEqual([
          'src/index.ts',
          'src/io/glob.ts',
        ],);
        expect(selection.excluded.map(function file(exclusion,): string {
          return exclusion.file;
        },),).toContain('src/io/glob.unit.test.ts',);
        expect(selection.excluded.map(function reason(exclusion,): string {
          return exclusion.reason;
        },),).toContain('test file',);
        expect(selection.excluded.map(function reason(exclusion,): string {
          return exclusion.reason;
        },),).toContain('declaration file',);
        expect(selection.excluded.map(function reason(exclusion,): string {
          return exclusion.reason;
        },),).toContain('fixture tree',);
      },
    },),
  ],
},);
