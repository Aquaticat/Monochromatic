/**
 * Tests for where a draw writes its outputs and, more importantly, when it
 * refuses to.
 *
 * Imports the built artifact like every other suite here. The guard is exported
 * through `sheet-barrel.ts` and marked `@internal`: it is run-driving tooling
 * rather than package API, but it is also the check standing between a routine
 * redraw and hours of human grading, so it is worth testing as what ships
 * rather than as what compiles.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  mkdtemp,
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
  GradedSheetExistsError,
  resolveSheetPath,
  UnsafeSeedError,
} from '../../dist/final/node/index.mjs';

/**
 * Fresh throwaway directory standing in for a runs directory.
 *
 * Never the real one: these cases plant files that would read as graded work.
 *
 * @returns Directory path
 *
 * @example
 * ```ts
 * const runsDir = await throwawayRunsDir();
 * ```
 */
async function throwawayRunsDir(): Promise<string> {
  return mkdtemp(join(
    tmpdir(),
    'translation-repair-sheet-path-',
  ),);
}

await describe({
  name: resolveSheetPath.name,
  children: [
    it({
      name: 'names each draw output distinctly, and gives the manifest a json '
        + 'extension since it is data rather than a sheet anyone reads',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        expect(
          await resolveSheetPath({
            runsDir,
            seed: 'cat-seed',
            isFinal: true,
          },),
        ).toBe(join(
          runsDir,
          'grading-sheet-cat-seed.md',
        ),);
        expect(
          await resolveSheetPath({
            runsDir,
            seed: 'cat-seed',
            isFinal: true,
            kind: 'repair',
          },),
        ).toBe(join(
          runsDir,
          'repair-sheet-cat-seed.md',
        ),);
        expect(
          await resolveSheetPath({
            runsDir,
            seed: 'cat-seed',
            isFinal: true,
            kind: 'manifest',
          },),
        ).toBe(join(
          runsDir,
          'sample-manifest-cat-seed.json',
        ),);
      },
    },),

    it({
      name: 'marks a preliminary draw in the name, so a scratch draw taken '
        + 'before coverage filled can never be mistaken for the gate',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        expect(
          await resolveSheetPath({
            runsDir,
            seed: 'cat-seed',
            isFinal: false,
            kind: 'manifest',
          },),
        ).toBe(join(
          runsDir,
          'sample-manifest-cat-seed-preliminary.json',
        ),);
      },
    },),

    it({
      name: 'refuses a final path that already exists, since the file may '
        + 'already carry hours of human grading',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        /** Path a previous draw wrote. */
        const path = await resolveSheetPath({
          runsDir,
          seed: 'cat-seed',
          isFinal: true,
        },);
        await writeFile(
          path,
          '### 1. graded already',
        );

        await expect(resolveSheetPath({
          runsDir,
          seed: 'cat-seed',
          isFinal: true,
        },),).rejects.toThrow(GradedSheetExistsError,);
      },
    },),

    it({
      name: 'refuses on the MANIFEST alone, which is what stops a redraw '
        + 'overwriting graded sheets: every path is resolved before any write, '
        + 'so one existing output aborts the draw while all of them are intact',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        /** Manifest a previous draw wrote, with no sheets beside it. */
        const manifestPath = await resolveSheetPath({
          runsDir,
          seed: 'cat-seed',
          isFinal: true,
          kind: 'manifest',
        },);
        await writeFile(
          manifestPath,
          '{}',
        );

        await expect(resolveSheetPath({
          runsDir,
          seed: 'cat-seed',
          isFinal: true,
          kind: 'manifest',
        },),).rejects.toThrow(GradedSheetExistsError,);
      },
    },),

    it({
      name: 'lets a preliminary path be rewritten, because scratch draws are '
        + 'meant to be redrawn as the pool grows',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        /** Preliminary path a previous scratch draw wrote. */
        const path = await resolveSheetPath({
          runsDir,
          seed: 'cat-seed',
          isFinal: false,
        },);
        await writeFile(
          path,
          '### 1. scratch',
        );

        expect(
          await resolveSheetPath({
            runsDir,
            seed: 'cat-seed',
            isFinal: false,
          },),
        ).toBe(path,);
      },
    },),

    it({
      name: 'refuses a seed that would escape the runs directory, before any '
        + 'path is built from it',
      fn: async () => {
        const runsDir = await throwawayRunsDir();

        await expect(resolveSheetPath({
          runsDir,
          seed: '../../escape',
          isFinal: true,
        },),).rejects.toThrow(UnsafeSeedError,);
        await expect(resolveSheetPath({
          runsDir,
          seed: 'has/separator',
          isFinal: true,
          kind: 'manifest',
        },),).rejects.toThrow(UnsafeSeedError,);
      },
    },),
  ],
},);
