/**
 * Tests for identifying a built pipeline by what its output directory holds.
 *
 * The digest decides which settled entries may be pooled and whether an
 * accumulation may resume, so every property here is load-bearing: an
 * order-dependent digest would refuse every resume, and a digest blind to a
 * changed file would pool two pipelines as one.
 *
 * Each case that asserts two directories agree is paired with one that must
 * disagree. A sameness claim from a probe that cannot show a difference proves
 * nothing at all, which is this package's recurring way of being wrong.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
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
  assertPipelineDigest,
  digestPipeline,
  isDigestShaped,
} from '../../dist/final/node/index.mjs';

/**
 * Contents of a minimal built output directory.
 */
const BUILT = {
  'index.mjs': 'export const mittens = 1;\n',
  'chunk-Whiskers.mjs': 'export const pepper = 2;\n',
} as const;

/**
 * Writes a throwaway output directory.
 *
 * @param files - file name to contents, at any depth
 *
 * @returns Path of the directory
 *
 * @example
 * ```ts
 * const dir = await writeBuild({ files: BUILT, },);
 * ```
 */
async function writeBuild(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'pipeline-digest-',
  ),);

  for (const [name, text,] of Object.entries(files,)) {
    /**
     * Path this file takes inside the fixture.
     */
    const path = join(
      dir,
      name,
    );

    /* oxlint-disable-next-line no-await-in-loop -- fixture setup, and nesting means a later file can need a directory an earlier one created */
    await mkdir(
      join(
        path,
        '..',
      ),
      { recursive: true, },
    );
    /* oxlint-disable-next-line no-await-in-loop -- same, sequential by design */
    await writeFile(
      path,
      text,
    );
  }

  return dir;
}

await describe({
  name: digestPipeline.name,
  children: [
    it({
      name: 'gives one digest for the same files whatever order they were '
        + 'written in, which is what makes a digest comparable at all: a '
        + 'directory read is not ordered, so an order-dependent digest would '
        + 'refuse resumes at random',
      fn: async () => {
        const one = await writeBuild({ files: BUILT, },);
        const two = await writeBuild({
          files: {
            'chunk-Whiskers.mjs': BUILT['chunk-Whiskers.mjs'],
            'index.mjs': BUILT['index.mjs'],
          },
        },);

        expect((await digestPipeline({ dir: one, },)).digest,)
          .toBe((await digestPipeline({ dir: two, },)).digest,);
      },
    },),

    it({
      name: 'MOVES when one executable byte changes, the positive control '
        + 'every sameness claim here rests on: without it, a digest that never '
        + 'changed would satisfy every other case in this file',
      fn: async () => {
        const one = await writeBuild({ files: BUILT, },);
        const two = await writeBuild({
          files: {
            ...BUILT,
            'index.mjs': 'export const mittens = 2;\n',
          },
        },);

        expect((await digestPipeline({ dir: one, },)).digest,)
          .not
          .toBe((await digestPipeline({ dir: two, },)).digest,);
      },
    },),

    it({
      name: 'IGNORES TypeScript declarations, because they cannot execute and '
        + 'they carry every TSDoc block verbatim while the built .mjs carries '
        + 'no comments at all. Hashing them would make a comment-only edit a '
        + 'new generation and force a fresh accumulation directory for a change '
        + 'that cannot alter a single result',
      fn: async () => {
        const one = await writeBuild({ files: BUILT, },);
        const two = await writeBuild({
          files: {
            ...BUILT,
            'index.d.mts': '/** Whiskers. */\nexport declare const mittens: number;\n',
          },
        },);

        expect((await digestPipeline({ dir: one, },)).digest,)
          .toBe((await digestPipeline({ dir: two, },)).digest,);
      },
    },),

    it({
      name: 'covers files at any depth, since a build free to emit chunks into '
        + 'a subdirectory would otherwise have half its code outside its own '
        + 'identity',
      fn: async () => {
        const flat = await writeBuild({ files: BUILT, },);
        const nested = await writeBuild({
          files: {
            ...BUILT,
            'inner/deep.mjs': 'export const biscuit = 3;\n',
          },
        },);

        expect((await digestPipeline({ dir: nested, },)).fileCount,).toBe(3,);
        expect((await digestPipeline({ dir: flat, },)).digest,)
          .not
          .toBe((await digestPipeline({ dir: nested, },)).digest,);
      },
    },),

    it({
      name: 'REFUSES a symbolic link rather than following or skipping it. The '
        + 'build emits none, so one being there means something else wrote into '
        + 'the output directory, and both other answers are wrong: following it '
        + 'digests bytes from outside the pipeline, skipping it drops code that '
        + 'will run',
      fn: async () => {
        const dir = await writeBuild({ files: BUILT, },);
        await symlink(
          join(
            dir,
            'index.mjs',
          ),
          join(
            dir,
            'linked.mjs',
          ),
        );

        await expect(digestPipeline({ dir, },),)
          .rejects
          .toThrow('symbolic link',);
      },
    },),

    it({
      name: 'REFUSES a directory holding nothing that could execute, since a '
        + 'digest over nothing is a constant every empty build would share, and '
        + 'a pass stamping it would claim a pipeline that does not exist',
      fn: async () => {
        const dir = await writeBuild({
          files: { 'index.d.mts': 'export declare const mittens: number;\n', },
        },);

        await expect(digestPipeline({ dir, },),)
          .rejects
          .toThrow('no file that could execute',);
      },
    },),

    it({
      name: 'reports the file count beside the digest, so a log line naming a '
        + 'truncated output directory is legible as one: a digest alone is '
        + 'unfalsifiable to a reader',
      fn: async () => {
        const dir = await writeBuild({ files: BUILT, },);

        expect((await digestPipeline({ dir, },)).fileCount,).toBe(2,);
      },
    },),
  ],
},);

await describe({
  name: isDigestShaped.name,
  children: [
    it({
      name: 'accepts what this module emits and refuses everything else, which '
        + 'is what keeps a foreign value out of the field the pool partitions '
        + 'by: uppercase is refused because one pipeline spelled two ways would '
        + 'count as two generations',
      fn: async () => {
        expect(isDigestShaped({ value: 'a'.repeat(64,), },),).toBe(true,);
        expect(isDigestShaped({ value: 'A'.repeat(64,), },),).toBe(false,);
        expect(isDigestShaped({ value: 'a'.repeat(63,), },),).toBe(false,);
        expect(isDigestShaped({ value: 'a'.repeat(65,), },),).toBe(false,);
        expect(isDigestShaped({ value: 'g'.repeat(64,), },),).toBe(false,);
        expect(isDigestShaped({ value: '', },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: assertPipelineDigest.name,
  children: [
    it({
      name: 'throws on a value no build produced, rather than narrowing it, so '
        + 'a digest read back from an artifact cannot enter the type system '
        + 'without passing the same test the writer passed',
      fn: async () => {
        expect(function narrows() {
          assertPipelineDigest('not-a-digest',);
        },).toThrow('lowercase hex',);
      },
    },),
  ],
},);
