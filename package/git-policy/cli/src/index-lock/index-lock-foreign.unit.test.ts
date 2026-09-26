/**
 Foreign `index.lock` holders against wrapped commits and index writers in disposable repositories:
 a native `commit --all` holding the lock in its editor,
 a killed native Git leaving the lock and its PID file,
 and a live native holder without PID evidence.

 @module
 */
import { access, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  jsonlEvents,
  type LandingRepository,
  runWrapper,
  writeWorktreeFile,
} from '../policy-engine/commit-landing-fixture.unit.test.ts';
import {
  holdNativeCommitAll,
  observeWrapper,
  waitUntil,
} from './index-lock-fixture.unit.test.ts';

/**
 Engine failure codes in a wrapper's stderr.

 @param stderr - wrapper stderr

 @returns codes
 */
function failureCodes(stderr: string,): readonly unknown[] {
  return jsonlEvents(stderr,)
    .filter(function isFailure(event,): boolean {
      return event.type === 'engine-failure';
    },)
    .map(function codeOf(event,): unknown {
      return event.code;
    },);
}

/**
 Reports whether a path exists.

 @param path - path

 @returns existence
 */
async function exists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 Prepares a repository with a tracked `b.txt` and a pending edit to `base.txt` for native `commit --all`.

 @returns repository
 */
async function prepared(): Promise<LandingRepository> {
  /** Repository. */
  const repository = await createLandingRepository();
  await writeWorktreeFile({ repository, name: 'b.txt', content: 'b0\n', },);
  await git({ repository, args: ['add', 'b.txt',], },);
  await git({ repository, args: ['commit', '--quiet', '-m', 'track b',], },);
  await writeWorktreeFile({ repository, name: 'base.txt', content: 'native\n', },);
  return repository;
}

await describe({
  name: 'foreign index.lock holders',
  children: [
    it({
      name: 'a wrapped commit waits for a native commit --all holding index.lock in its editor and lands after it finishes',
      fn: async function testWaitThenLand(): Promise<void> {
        await using repository = await prepared();
        /** Native commit that the editor aborts, leaving HEAD unmoved. */
        const native = await holdNativeCommitAll({ repository, name: 'aborted', lockfilePid: true, message: '', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b1\n', },);
        /** Wrapped commit. */
        const wrapped = observeWrapper({ repository, args: ['commit', '-m', 'wrapped', 'b.txt',], },);
        await waitUntil({ predicate: function waiting(): boolean {
          return wrapped.stderr().includes(`cli-git: waiting for PID ${String(native.pid,)}`,);
        }, },);
        expect(wrapped.exited(),).toBe(false,);
        await native.release();
        expect(await native.exitCode,).toBe(1,);
        /** Wrapped outcome. */
        const outcome = await wrapped.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(outcome.stderr.split(`waiting for PID ${String(native.pid,)}`,).length,).toBe(2,);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('wrapped\ntrack b\nbaseline',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('M base.txt',);
      },
    },),
    it({
      name: 'a wrapped commit waits for a native commit --all that then commits, never failing on index.lock',
      fn: async function testWaitThenMoved(): Promise<void> {
        await using repository = await prepared();
        /** Native commit that succeeds. */
        const native = await holdNativeCommitAll({ repository, name: 'native', lockfilePid: true, message: 'native\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b1\n', },);
        /** Wrapped commit. */
        const wrapped = observeWrapper({ repository, args: ['commit', '-m', 'wrapped', 'b.txt',], },);
        await waitUntil({ predicate: function waiting(): boolean {
          return wrapped.stderr().includes(`cli-git: waiting for PID ${String(native.pid,)}`,);
        }, },);
        await native.release();
        expect(await native.exitCode,).toBe(0,);
        /** Wrapped outcome. */
        const outcome = await wrapped.outcome;
        expect(failureCodes(outcome.stderr,),).toEqual([],);
        expect(outcome.stderr,).not.toContain('File exists',);
        /** History after both. */
        const log = await git({ repository, args: ['log', '--format=%s',], },);
        // Landing after a moved branch replays once replay exists; until then it fails fast with head-moved.
        expect([
          (outcome.exitCode === 0) && (log === 'wrapped\nnative\ntrack b\nbaseline'),
          (outcome.exitCode === 1) && outcome.stderr.includes('concurrent-commit/head-moved',) && (log === 'native\ntrack b\nbaseline'),
        ].includes(true,),).toBe(true,);
      },
    },),
    it({
      name: 'a killed native Git leaving index.lock and its PID file fails wrapped commits and adds after the budget, keeping the lock',
      fn: async function testKilled(): Promise<void> {
        await using repository = await prepared();
        /** Native commit to kill. */
        const native = await holdNativeCommitAll({ repository, name: 'killed', lockfilePid: true, message: 'never\n', },);
        native.child.kill('SIGKILL',);
        expect(await native.exitCode,).toBe('SIGKILL',);
        await native.release();
        expect(
          await exists(join(repository.gitDir, 'index.lock',),),
        ).toBe(true,);
        expect(
          await exists(join(repository.gitDir, 'index~pid.lock',),),
        ).toBe(true,);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b1\n', },);
        await writeWorktreeFile({ repository, name: 'new.txt', content: 'new\n', },);
        /** Start of the wrapped commit. */
        const startedAt = Date.now();
        /** Wrapped commit. */
        const commit = await runWrapper({ repository, args: ['commit', '-m', 'wrapped', 'b.txt',], },);
        expect((Date.now() - startedAt) >= 1_000,).toBe(true,);
        expect(commit.exitCode,).toBe(2,);
        expect(failureCodes(commit.stderr,),).toEqual(['index-lock-unproven-owner',],);
        expect(commit.stderr,).toContain(`owner PID ${String(native.pid,)} no longer runs`,);
        expect(commit.stderr,).toContain('landed nothing',);
        /** Wrapped add. */
        const add = await runWrapper({ repository, args: ['add', '--', 'new.txt',], },);
        expect(add.exitCode,).toBe(2,);
        expect(failureCodes(add.stderr,),).toEqual(['index-lock-unproven-owner',],);
        expect(add.stderr,).toContain('did not run git add',);
        expect(await git({ repository, args: ['ls-files', '--', 'new.txt',], },),).toBe('',);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('track b\nbaseline',);
        expect(
          await exists(join(repository.gitDir, 'index.lock',),),
        ).toBe(true,);
        expect(
          await exists(join(repository.gitDir, 'index~pid.lock',),),
        ).toBe(true,);
      },
    },),
    it({
      name: 'a live native holder without PID evidence fails a wrapped commit after the budget as unproven',
      fn: async function testUnproven(): Promise<void> {
        await using repository = await prepared();
        /** Native commit without core.lockfilePid. */
        const native = await holdNativeCommitAll({ repository, name: 'plain', lockfilePid: false, message: 'native\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b1\n', },);
        /** Wrapped commit. */
        const commit = await runWrapper({ repository, args: ['commit', '-m', 'wrapped', 'b.txt',], },);
        await native.release();
        expect(await native.exitCode,).toBe(0,);
        expect(commit.exitCode,).toBe(2,);
        expect(failureCodes(commit.stderr,),).toEqual(['index-lock-unproven-owner',],);
        expect(commit.stderr,).toContain('could not prove alive',);
        expect(commit.stderr,).toContain('no PID file',);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('native\ntrack b\nbaseline',);
      },
    },),
  ],
},);
