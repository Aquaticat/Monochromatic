/**
 * Tests for what the scheduler counts as settled.
 *
 * The module note records a past silent defect: a directory or a symlink named
 * `<id>.json` once marked the entry settled, and the entry was never run again.
 * These cases hold that line, and the agreement between the id set and the
 * count that the against-target line reads.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  artifactBackedIds,
  countSettled,
} from '../../dist/final/node/index.mjs';

/**
 * Fresh artifacts directory holding two regular artifacts, one directory named
 * like one, one symlink named like one, and one regular file without the
 * suffix.
 *
 * @returns Directory path
 *
 * @example
 * ```ts
 * const artifactsDir = await mixedDirectory();
 * ```
 */
async function mixedDirectory(): Promise<string> {
  /**
   * Disposable root, never the package's own runs directory.
   */
  const artifactsDir = await mkdtemp(join(tmpdir(), 'pass-settled-',),);
  await writeFile(join(artifactsDir, 'whiskers.json',), '{}', 'utf8',);
  await writeFile(join(artifactsDir, 'tabby.json',), '{}', 'utf8',);
  await mkdir(join(artifactsDir, 'mittens.json',),);
  await symlink('tabby.json', join(artifactsDir, 'ghost.json',),);
  await writeFile(join(artifactsDir, 'notes.txt',), 'not an artifact', 'utf8',);
  return artifactsDir;
}

await describe({
  name: artifactBackedIds.name,
  children: [
    it({
      name: 'REFUSES to count a directory named like an artifact, which once marked an entry settled without '
        + 'the entry ever having run',
      fn: async () => {
        const ids = await artifactBackedIds({ artifactsDir: await mixedDirectory(), },);

        expect(ids.has('mittens',),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES to count a symlink named like an artifact, for the same reason',
      fn: async () => {
        const ids = await artifactBackedIds({ artifactsDir: await mixedDirectory(), },);

        expect(ids.has('ghost',),).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS every regular artifact under its id, and nothing without the suffix',
      fn: async () => {
        const ids = await artifactBackedIds({ artifactsDir: await mixedDirectory(), },);

        expect([...ids,].toSorted(),).toEqual([
          'tabby',
          'whiskers',
        ],);
      },
    },),
  ],
},);

await describe({
  name: countSettled.name,
  children: [
    it({
      name: 'counts exactly the ids the scheduler would skip, so the against-target line and the '
        + 'skip set cannot drift apart again',
      fn: async () => {
        /**
         * One directory read by both.
         */
        const artifactsDir = await mixedDirectory();

        expect(await countSettled({ artifactsDir, },),).toBe(
          (await artifactBackedIds({ artifactsDir, },)).size,
        );
        expect(await countSettled({ artifactsDir, },),).toBe(2,);
      },
    },),
  ],
},);
