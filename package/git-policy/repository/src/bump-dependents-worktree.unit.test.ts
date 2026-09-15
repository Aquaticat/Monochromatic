/** Worktree dependent ripple unit tests over a disposable Git repository. @module */
import { execFile, } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';
import { promisify, } from 'node:util';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  bumpWorktreeDependents,
  WorktreeBumpConflictError,
} from '../dist/final/node/index.mjs';

/**
 Node's `promisify` specialized to `execFile`'s declared promise contract.

 See `doc/troubleshooting/oxlint-promisify-void-return.md`.
 */
const promisifyExecFile: (original: typeof execFile) => typeof execFile.__promisify__ = promisify;

/**
 Promise form of `execFile`.
 */
const run = promisifyExecFile(execFile,);

/**
 Real Git for fixture setup, bypassing any PATH shim that enforces commit policies on the disposable repository.
 */
const REAL_GIT = '/usr/bin/git';

/**
 Serializes one manifest.

 @param manifest - manifest object

 @returns manifest text
 */
function manifestText(manifest: Readonly<Record<string, unknown>>,): string {
  return `${JSON.stringify(
    manifest,
    undefined,
    2,
  )}\n`;
}

/**
 Baseline workspace files keyed by repository path.
 */
const BASELINE: Readonly<Record<string, string>> = {
  'package/config/pnpr/config.yaml': "packages:\n  - '@s/app'\n  - '@s/base'\n  - '@s/tool'\nnext: 1\n",
  'package/module/base/package.json': manifestText({
    name: '@s/base',
    version: '1.0.0',
  },),
  'package/module/app/package.json': manifestText({
    name: '@s/app',
    version: '2.0.0',
    dependencies: { '@s/base': 'workspace:*', },
  },),
  'package/module/tool/package.json': manifestText({
    name: '@s/tool',
    version: '0.1.0',
    devDependencies: { '@s/base': 'workspace:*', },
  },),
  'package/module/tool/src/index.ts': "export { base } from '@s/base/ts';\n",
};

/**
 Creates a disposable repository holding the baseline commit.

 @returns repository path
 */
async function createRepository(): Promise<string> {
  /**
   Disposable repository root.
   */
  const repository = await mkdtemp(join(
    tmpdir(),
    'bump-dependents-',
  ),);
  await run(
    REAL_GIT,
    [
      'init',
      '--quiet',
    ],
    { cwd: repository, },
  );
  for (const [path, text,] of Object.entries(BASELINE,)) {
    // oxlint-disable-next-line no-await-in-loop -- Fixture files are few and written in order.
    await mkdir(
      dirname(join(
        repository,
        path,
      ),),
      { recursive: true, },
    );
    // oxlint-disable-next-line no-await-in-loop -- Fixture files are few and written in order.
    await writeFile(
      join(
        repository,
        path,
      ),
      text,
    );
  }
  await run(
    REAL_GIT,
    [
      'add',
      '--all',
    ],
    { cwd: repository, },
  );
  await run(
    REAL_GIT,
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--quiet',
      '--no-verify',
      '-m',
      'baseline',
    ],
    { cwd: repository, },
  );
  return repository;
}

await describe({
  name: bumpWorktreeDependents.name,
  children: [
    it({
      name: 'writes bumps for runtime and bundled dependents of a worktree bump',
      fn: async function testWorktreeRipple(): Promise<void> {
        /**
         Disposable repository.
         */
        const repository = await createRepository();
        await writeFile(
          join(
            repository,
            'package/module/base/package.json',
          ),
          manifestText({
            name: '@s/base',
            version: '1.1.0',
          },),
        );
        /**
         Applied plan.
         */
        const plan = await bumpWorktreeDependents({
          repositoryRoot: repository,
          baseRevision: 'HEAD',
        },);
        expect(plan.bumpedNames,).toEqual(['@s/base',],);
        expect(plan.bumps.map(function toSummary(bump,) {
          return `${bump.name}@${bump.to}`;
        },),).toEqual(['@s/app@2.0.1', '@s/tool@0.1.1',],);
        expect(await readFile(
          join(
            repository,
            'package/module/tool/package.json',
          ),
          'utf8',
        ),).toContain('"version": "0.1.1"',);
        await rm(
          repository,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),
    it({
      name: 'changes nothing when no manifest differs from the base',
      fn: async function testNoBump(): Promise<void> {
        /**
         Disposable repository.
         */
        const repository = await createRepository();
        /**
         Applied plan.
         */
        const plan = await bumpWorktreeDependents({
          repositoryRoot: repository,
          baseRevision: 'HEAD',
        },);
        expect(plan.bumps,).toEqual([],);
        expect(await readFile(
          join(
            repository,
            'package/module/app/package.json',
          ),
          'utf8',
        ),).toBe(BASELINE['package/module/app/package.json'],);
        await rm(
          repository,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),
    it({
      name: 'exports a conflict error naming the manifest',
      fn: async function testConflictError(): Promise<void> {
        /**
         Constructed conflict.
         */
        const error = new WorktreeBumpConflictError('package/module/app/package.json',);
        expect(error.message,).toContain('package/module/app/package.json',);
        expect(error.name,).toBe('WorktreeBumpConflictError',);
      },
    },),
  ],
},);
