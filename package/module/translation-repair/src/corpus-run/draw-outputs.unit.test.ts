/**
 * Tests for the lifetime of the files one draw writes.
 *
 * A draw produces three outputs that only mean anything together, and a final
 * path is refused once it exists. A fault between writes therefore leaves a
 * partial set that the refusal then blocks the next draw on, and the obstacle
 * is a file nobody ever graded. These cases pin that a failed draw leaves
 * nothing behind and a finished one leaves everything.
 *
 * Every case runs against a throwaway directory from `mkdtemp`, never the real
 * runs directory, because the behaviour under test is file REMOVAL.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { trackDrawOutputs, } from '../../dist/final/node/index.mjs';

/**
 * Makes a throwaway directory and removes it when the scope ends.
 *
 * @returns Directory path plus its disposer
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<AsyncDisposable & {
  readonly path: string;
}> {
  /**
   * Throwaway directory for one case.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-draw-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: trackDrawOutputs.name,
  children: [
    it({
      name: 'removes what an UNCOMMITTED draw wrote, so a fault between the '
        + 'three writes leaves no partial set. The overwrite guard refuses a '
        + 'final path that exists, so a half-written set would block every '
        + 'later draw on files nobody had graded',
      fn: async () => {
        await using scratch = await scratchDir();
        /**
         * Sheet the draw got as far as writing.
         */
        const sheet = join(
          scratch.path,
          'grading-sheet.md',
        );

        {
          await using outputs = trackDrawOutputs();
          await writeFile(
            sheet,
            'partial',
          );
          outputs.record({ path: sheet, },);
          // Scope ends WITHOUT commit, standing in for a throw partway.
        }

        expect(await readdir(scratch.path,),).toEqual([],);
      },
    },),

    it({
      name: 'keeps everything a COMMITTED draw wrote, since a complete set is '
        + 'the record of one draw and the manifest inside it is the only thing '
        + 'that can ever join a human grade to a machine verdict',
      fn: async () => {
        await using scratch = await scratchDir();

        {
          await using outputs = trackDrawOutputs();
          /**
           * Every output of the completed set.
           */
          const paths = [
            'grading-sheet.md',
            'repair-sheet.md',
            'sample-manifest.json',
          ].map(function toPath(name,) {
            return join(
              scratch.path,
              name,
            );
          },);
          await Promise.all(paths.map(function writeOne(path,) {
            return writeFile(
              path,
              'done',
            );
          },),);
          for (const path of paths)
            outputs.record({ path, },);
          outputs.commit();
        }

        expect((await readdir(scratch.path,)).toSorted(),).toEqual([
          'grading-sheet.md',
          'repair-sheet.md',
          'sample-manifest.json',
        ],);
      },
    },),

    it({
      name: 'removes only what it RECORDED, leaving files it never wrote. The '
        + 'runs directory holds earlier rounds\' graded sheets, and a cleanup '
        + 'that swept the directory rather than its own list would destroy '
        + 'exactly the work the overwrite guard exists to protect',
      fn: async () => {
        await using scratch = await scratchDir();
        /**
         * Graded sheet from an earlier round, untouched by this draw.
         */
        const earlier = join(
          scratch.path,
          'grading-sheet-round-two.md',
        );
        await writeFile(
          earlier,
          'hours of human grading',
        );

        {
          await using outputs = trackDrawOutputs();
          /**
           * This draw's own output.
           */
          const mine = join(
            scratch.path,
            'grading-sheet-round-three.md',
          );
          await writeFile(
            mine,
            'partial',
          );
          outputs.record({ path: mine, },);
        }

        expect(await readdir(scratch.path,),).toEqual([
          'grading-sheet-round-two.md',
        ],);
      },
    },),

    it({
      name: 'disposes cleanly when a recorded file is already gone, which is '
        + 'the ordinary shape of the failure: the write that threw is the one '
        + 'whose file may never have been created',
      fn: async () => {
        await using scratch = await scratchDir();

        await using outputs = trackDrawOutputs();
        outputs.record({
          path: join(
            scratch.path,
            'never-written.md',
          ),
        },);

        // Disposing must not throw; reaching the next line is the assertion.
        await outputs[Symbol.asyncDispose]();
        expect(await readdir(scratch.path,),).toEqual([],);
      },
    },),
  ],
},);
