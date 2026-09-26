/**
 Capture order through the built wrapper on disposable repositories:
 the later capture of a path wins in both directions,
 a change landed from another worktree still goes through subsumption and the merge,
 recovery records the capture of a landing that crashed after its compare-and-swap,
 and the capture lock serializes captures, survives a dead holder, and keeps the sequence.

 Every wrapper, editor, and hook runs in a process group the repository kills on disposal.

 @module
 */
import { once, } from 'node:events';
import {
  access,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  finish,
  git,
  type LandingRepository,
  leftovers,
  runWrapper,
  startWrapper,
  waitForFile,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventOfType,
  eventTypes,
  findingCodes,
  holdInEditor,
  numberedLines,
} from './commit-landing-replay-fixture.unit.test.ts';

/**
 Commits a numbered-lines `f.txt` natively.

 @param repository - fixture repository
 */
async function commitLines(repository: LandingRepository,): Promise<void> {
  await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({},), },);
  await git({ repository, args: ['add', 'f.txt',], },);
  await git({ repository, args: ['commit', '--quiet', '-m', 'lines',], },);
}

/**
 Reads a committed file with its final newline.

 @param repository - fixture repository

 @param spec - `<rev>:<path>`

 @returns file text
 */
async function shown(repository: LandingRepository, spec: string,): Promise<string> {
  return `${await git({ repository, args: ['show', spec,], },)}\n`;
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

await describe({
  name: 'capture order at landing',
  children: [
    it({
      name: 'a commit captured after another commit\'s capture of the same line lands its own bytes after a replay, as native sequential commits would',
      fn: async function testPreparedLater(): Promise<void> {
        await using repository = await createLandingRepository();
        await commitLines(repository,);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'first', },), },);
        /** First commit, captured first. */
        const first = await holdInEditor({ repository, name: 'first', args: ['commit', '-e', '-m', 'first', 'f.txt',], },);
        // The second agent rewrites the line the first one just edited.
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'second', },), },);
        /** Second commit, captured later. */
        const second = await holdInEditor({ repository, name: 'second', args: ['commit', '-e', '-m', 'second', 'f.txt',], },);
        await first.release();
        expect((await first.outcome).exitCode,).toBe(0,);
        /** Landed first commit. */
        const landed = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        expect(await shown(repository, 'HEAD:f.txt',),).toBe(numberedLines({ 5: 'first', },),);
        await second.release();
        /** Replayed second commit. */
        const outcome = await second.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(landed,);
        expect(await shown(repository, 'HEAD:f.txt',),).toBe(numberedLines({ 5: 'second', },),);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a commit captured before another commit that landed first keeps the landed bytes of the shared path and lands its other paths',
      fn: async function testLandedLater(): Promise<void> {
        await using repository = await createLandingRepository();
        await commitLines(repository,);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'first', },), },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** First commit, captured first, held while the later capture lands. */
        const first = await holdInEditor({ repository, name: 'first', args: ['commit', '-e', '-m', 'first', 'f.txt', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'second', },), },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'second', 'f.txt',], },)).exitCode,).toBe(0,);
        /** Landed second commit. */
        const landed = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await first.release();
        /** Replayed first commit. */
        const outcome = await first.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(landed,);
        expect(await shown(repository, 'HEAD:f.txt',),).toBe(numberedLines({ 5: 'second', },),);
        expect(await shown(repository, 'HEAD:a.txt',),).toBe('a\n',);
        expect(await git({ repository, args: ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD',], },),).toBe('a.txt',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a change landed from another worktree has no capture here, so an overlapping edit conflicts and a far one merges',
      fn: async function testOtherWorktree(): Promise<void> {
        await using repository = await createLandingRepository();
        await commitLines(repository,);
        /** Linked worktree on its own branch. */
        const other = join(repository.scratch, 'other',);
        await git({ repository, args: ['worktree', 'add', '--quiet', '-b', 'side', other,], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 1: 'mine', },), },);
        /** Commit held after its capture. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'f.txt',], },);
        await writeFile(join(other, 'f.txt',), numberedLines({ 1: 'theirs', 10: 'far', },),);
        expect((await runWrapper({ repository, args: ['-C', other, 'commit', '-m', 'theirs', 'f.txt',], },)).exitCode,).toBe(0,);
        // The other worktree's commit reaches main without a capture of this worktree.
        await git({ repository, args: ['update-ref', 'refs/heads/main', 'side',], },);
        /** Commit that won. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await held.release();
        /** Conflicted outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/replay-conflict',],);
        expect(eventOfType({ outcome, type: 'core-finding', },),).toMatchObject({ paths: ['f.txt',], winningOid: winner, },);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(winner,);
        // A far edit from the other worktree merges three-way instead.
        await git({ repository, args: ['reset', '--quiet', 'HEAD',], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 1: 'theirs', 5: 'mine', 10: 'far', },), },);
        /** Second held commit. */
        const merged = await holdInEditor({ repository, name: 'merged', args: ['commit', '-e', '-m', 'mine again', 'f.txt',], },);
        await writeFile(join(other, 'f.txt',), numberedLines({ 1: 'theirs', 9: 'other', 10: 'far', },),);
        expect((await runWrapper({ repository, args: ['-C', other, 'commit', '-m', 'other', 'f.txt',], },)).exitCode,).toBe(0,);
        await git({ repository, args: ['update-ref', 'refs/heads/main', 'side',], },);
        await merged.release();
        expect((await merged.outcome).exitCode,).toBe(0,);
        expect(await shown(repository, 'HEAD:f.txt',),).toBe(numberedLines({ 1: 'theirs', 5: 'mine', 9: 'other', 10: 'far', },),);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a landing killed after its compare-and-swap gets its capture recorded by recovery, so a commit captured before it keeps its bytes',
      fn: async function testRecoveredRecord(): Promise<void> {
        await using repository = await createLandingRepository();
        await commitLines(repository,);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'early', },), },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Commit captured first and held. */
        const early = await holdInEditor({ repository, name: 'early', args: ['commit', '-e', '-m', 'early', 'f.txt', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 5: 'late', },), },);
        /** Later capture, killed right after its compare-and-swap, before it records its capture. */
        const late = startWrapper({ repository, args: ['commit', '-m', 'late', 'f.txt',], env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `ref-updated:kill:${repository.scratch}`, }, },);
        await once(late, 'exit',);
        expect(
          await exists(join(repository.scratch, 'ref-updated.reached',),),
        ).toBe(true,);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('late',);
        // Startup recovery completes the landing and writes its landed-capture record.
        expect((await runWrapper({ repository, args: ['status', '--porcelain',], },)).exitCode,).toBe(0,);
        await early.release();
        /** Replayed early commit. */
        const outcome = await early.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(await shown(repository, 'HEAD:f.txt',),).toBe(numberedLines({ 5: 'late', },),);
        expect(await shown(repository, 'HEAD:a.txt',),).toBe('a\n',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a capture waits while another holds the capture lock, and the sequence counts both captures',
      fn: async function testContention(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Sequence file. */
        const sequence = join(repository.gitDir, 'cli-git-captures', 'sequence',);
        /** Holder paused inside the capture lock. */
        const holder = finish(startWrapper({ repository, args: ['commit', '-m', 'a', 'a.txt',], env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `capture-locked:pause:${repository.scratch}`, }, },),);
        await waitForFile({ path: join(repository.scratch, 'capture-locked.reached',), },);
        /** Waiting capture. */
        const waiter = startWrapper({ repository, args: ['commit', '-m', 'b', 'b.txt',], },);
        /** Its outcome. */
        const waited = finish(waiter,);
        await wait(700,);
        expect(waiter.exitCode,).toBe(null,);
        expect(await exists(sequence,),).toBe(false,);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('baseline',);
        await writeFile(join(repository.scratch, 'capture-locked.release',), '',);
        expect((await holder).exitCode,).toBe(0,);
        expect((await waited).exitCode,).toBe(0,);
        expect(await readFile(sequence, 'utf8',),).toBe('2\n',);
        expect((await git({ repository, args: ['log', '--format=%s',], },)).split('\n',).toSorted(),).toEqual(['a', 'b', 'baseline',],);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a capture-lock holder killed inside the lock is retired by the next capture, and the sequence and identity persist across invocations',
      fn: async function testDeadHolder(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        await writeWorktreeFile({ repository, name: 'c.txt', content: 'c\n', },);
        /** Holder killed while it holds the capture lock. */
        const killed = startWrapper({ repository, args: ['commit', '-m', 'a', 'a.txt',], env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: 'capture-locked:kill', }, },);
        await once(killed, 'exit',);
        expect(
          await exists(join(repository.gitDir, 'cli-git-captures', 'capture.lock',),),
        ).toBe(true,);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'b', 'b.txt',], },)).exitCode,).toBe(0,);
        /** Store identity after the first capture. */
        const identity = await readFile(join(repository.gitDir, 'cli-git-captures', 'worktree-id',), 'utf8',);
        expect(await readFile(join(repository.gitDir, 'cli-git-captures', 'sequence',), 'utf8',),).toBe('1\n',);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'c', 'c.txt',], },)).exitCode,).toBe(0,);
        expect(await readFile(join(repository.gitDir, 'cli-git-captures', 'sequence',), 'utf8',),).toBe('2\n',);
        expect(await readFile(join(repository.gitDir, 'cli-git-captures', 'worktree-id',), 'utf8',),).toBe(identity,);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('c\nb\nbaseline',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
