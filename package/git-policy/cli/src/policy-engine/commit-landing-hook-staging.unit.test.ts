/**
 Lint-staged-style `pre-commit` hooks that rewrite and re-stage files:
 the commit keeps what the hook staged,
 as native Git does,
 and landing reconciles the hook's paths in the real index and the worktree
 only while they still hold their pre-hook state.

 @module
 */
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  leftovers,
  readText,
  REAL_GIT,
  runWrapper,
  writeHook,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  holdInEditor,
  stageContent,
} from './commit-landing-replay-fixture.unit.test.ts';

/**
 Hook body that upper-cases `a.txt` in the worktree and re-stages it, as a formatter run by lint-staged does.
 */
const FORMAT_WORKTREE_SOURCE = `const fs = require('node:fs');
fs.writeFileSync('a.txt', fs.readFileSync('a.txt', 'utf8').toUpperCase());
require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['add', 'a.txt']);`;

/**
 Hook body that stages an upper-cased `a.txt` without touching the worktree, as a staged-content formatter does.
 */
const FORMAT_INDEX_SOURCE = `const { execFileSync } = require('node:child_process');
const staged = execFileSync(${JSON.stringify(REAL_GIT,)}, ['show', ':a.txt'], { encoding: 'utf8' });
const oid = execFileSync(${JSON.stringify(REAL_GIT,)}, ['hash-object', '-w', '--stdin'], { input: staged.toUpperCase(), encoding: 'utf8' }).trim();
execFileSync(${JSON.stringify(REAL_GIT,)}, ['update-index', '--cacheinfo', '100644,' + oid + ',a.txt']);`;

await describe({
  name: 'hook-staged commit trees',
  children: [
    it({
      name: 'a formatter hook that rewrites and re-stages a selected file lands the formatted bytes with a clean status',
      fn: async function testWorktreeFormatter(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({ repository, event: 'pre-commit', source: FORMAT_WORKTREE_SOURCE, },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'lower\n', },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'formatted', 'a.txt',], },)).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:a.txt',], },),).toBe('LOWER',);
        expect(await git({ repository, args: ['show', ':a.txt',], },),).toBe('LOWER',);
        expect(await readText(join(repository.path, 'a.txt',),),).toBe('LOWER\n',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a hook that formats only the staged blob brings the unchanged worktree copy to the committed bytes',
      fn: async function testIndexFormatter(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({ repository, event: 'pre-commit', source: FORMAT_INDEX_SOURCE, },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'lower\n', },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'formatted', 'a.txt',], },)).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:a.txt',], },),).toBe('LOWER',);
        expect(await readText(join(repository.path, 'a.txt',),),).toBe('LOWER\n',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a worktree edit made after the hook ran is kept, and the committed bytes stay in HEAD',
      fn: async function testConcurrentWorktreeEdit(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({ repository, event: 'pre-commit', source: FORMAT_INDEX_SOURCE, },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'lower\n', },);
        /** Commit held in its editor after the hook ran. */
        const held = await holdInEditor({ repository, name: 'formatted', args: ['commit', '-e', '-m', 'formatted', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'user edit\n', },);
        await held.release();
        expect((await held.outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:a.txt',], },),).toBe('LOWER',);
        expect(await readText(join(repository.path, 'a.txt',),),).toBe('user edit\n',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('M a.txt',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a path the hook staged outside the selection keeps a real index entry restaged while the commit ran',
      fn: async function testConcurrentRestage(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({
          repository,
          event: 'pre-commit',
          source: `require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['add', 'extra.txt']);`,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'extra.txt', content: 'extra\n', },);
        /** Commit held in its editor after the hook staged extra.txt privately. */
        const held = await holdInEditor({ repository, name: 'extra', args: ['commit', '-e', '-m', 'extra', 'a.txt',], },);
        /** Blob staged into the real index meanwhile. */
        const restaged = await stageContent({ repository, path: 'extra.txt', content: 'restaged\n', },);
        await held.release();
        expect((await held.outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:extra.txt',], },),).toBe('extra',);
        expect(await git({ repository, args: ['rev-parse', ':extra.txt',], },),).toBe(restaged,);
        expect(await git({ repository, args: ['show', ':a.txt',], },),).toBe('a',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'an index commit whose hook formats a staged file installs the formatted entry in the real index',
      fn: async function testIndexModeFormatter(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({ repository, event: 'pre-commit', source: FORMAT_WORKTREE_SOURCE, },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'lower\n', },);
        await git({ repository, args: ['add', 'a.txt',], },);
        expect((await runWrapper({ repository, args: ['commit', '--no-only', '-m', 'formatted',], },)).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:a.txt',], },),).toBe('LOWER',);
        expect(await git({ repository, args: ['show', ':a.txt',], },),).toBe('LOWER',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
