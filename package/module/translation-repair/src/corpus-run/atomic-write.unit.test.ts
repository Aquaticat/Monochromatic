/**
 * Tests for writing an artifact no concurrent reader can catch half-written.
 *
 * The window is small and the consequence is a silently wrong denominator: a
 * partial file is classified as malformed, the pool keeps malformed files on
 * purpose so the reader that reports them still sees them, and a later reader
 * parses the now-complete file and counts it without the generation checks it
 * should have faced.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { writeFileAtomic, } from '../../dist/final/node/index.mjs';

/**
 * Makes a throwaway directory for one case.
 *
 * @returns Path of the directory
 *
 * @example
 * ```ts
 * const dir = await scratch();
 * ```
 */
async function scratch(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'atomic-write-',
  ),);
}

await describe({
  name: writeFileAtomic.name,
  children: [
    it({
      name: 'writes the content under the name asked for, which is the whole '
        + 'contract a caller sees: the temporary name is an implementation '
        + 'detail no reader may ever meet',
      fn: async () => {
        const dir = await scratch();

        /**
         * Path the artifact takes.
         */
        const path = join(
          dir,
          'Mittens.json',
        );

        await writeFileAtomic({
          path,
          text: '{"id":"Mittens"}\n',
        },);

        expect(await readFile(
          path,
          'utf8',
        ),).toBe('{"id":"Mittens"}\n',);
      },
    },),

    it({
      name: 'LEAVES NO partial file behind, since a leftover would sit in the '
        + 'artifacts directory the readers glob and would be counted by every '
        + 'listing that keys on a name rather than on content',
      fn: async () => {
        const dir = await scratch();

        await writeFileAtomic({
          path: join(
            dir,
            'Mittens.json',
          ),
          text: '{"id":"Mittens"}\n',
        },);

        expect(await readdir(dir,),).toEqual(['Mittens.json',],);
      },
    },),

    it({
      name: 'replaces an existing artifact rather than appending to it or '
        + 'refusing, which is what a re-settled entry needs',
      fn: async () => {
        const dir = await scratch();

        /**
         * Path holding an older artifact for the same entry.
         */
        const path = join(
          dir,
          'Mittens.json',
        );
        await writeFile(
          path,
          '{"id":"Mittens","status":"stale"}\n',
        );

        await writeFileAtomic({
          path,
          text: '{"id":"Mittens","status":"repaired"}\n',
        },);

        expect(await readFile(
          path,
          'utf8',
        ),).toBe('{"id":"Mittens","status":"repaired"}\n',);
        expect(await readdir(dir,),).toEqual(['Mittens.json',],);
      },
    },),

    it({
      name: 'writes bytes the artifacts a real pass produces are made of, '
        + 'including multi-byte text, so the rename path is exercised on a '
        + 'payload of the shape it actually carries rather than on ASCII alone',
      fn: async () => {
        const dir = await scratch();

        /**
         * Path the artifact takes.
         */
        const path = join(
          dir,
          'Pepper.json',
        );

        /**
         * Artifact body carrying text outside the ASCII range.
         */
        const text = `${JSON.stringify({
          id: 'Pepper',
          note: 'ペッパーは窓辺で眠る',
        },)}\n`;

        await writeFileAtomic({
          path,
          text,
        },);

        expect(await readFile(
          path,
          'utf8',
        ),).toBe(text,);
      },
    },),
  ],
},);
