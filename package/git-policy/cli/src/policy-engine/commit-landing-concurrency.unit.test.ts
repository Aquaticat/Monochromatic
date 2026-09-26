/**
 Overlapping commits against one worktree and branch, driven through the built wrapper with editor and hook barriers.

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
  runWrapper,
  writeHook,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventTypes,
  findingCodes,
  holdInEditor,
} from './commit-landing-replay-fixture.unit.test.ts';

await describe({
  name: 'concurrent commit landing',
  children: [
    it({
      name: 'a commit landing while another waits in its editor wins, and the waiting one replays onto it after pre-commit re-runs, never EEXIST',
      fn: async function testReplayAfterEditor(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Pre-commit log proving the second commit's hook ran while the first editor was open. */
        const log = join(repository.scratch, 'hooks.log',);
        await writeHook({ repository, event: 'pre-commit', source: `require('node:fs').appendFileSync(${JSON.stringify(log,)}, 'pre-commit\\n');`, },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** First commit, held in its editor. */
        const first = await holdInEditor({ repository, name: 'first', args: ['commit', '-e', '-m', 'first', 'a.txt',], },);
        /** Second commit, run to completion meanwhile. */
        const second = await runWrapper({ repository, args: ['commit', '-m', 'second', 'b.txt',], },);
        expect(second.exitCode,).toBe(0,);
        await first.release();
        /** First commit's outcome. */
        const firstOutcome = await first.outcome;
        expect(firstOutcome.exitCode,).toBe(0,);
        expect(eventTypes(firstOutcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        expect(firstOutcome.stderr,).not.toContain('index.lock',);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('first\nsecond\nbaseline',);
        expect(await git({ repository, args: ['show', '--name-only', '--format=', 'HEAD',], },),).toBe('a.txt',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        // Preparation of each commit, then the re-run against the replayed tree.
        expect(await readText(log,),).toBe('pre-commit\npre-commit\npre-commit\n',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'two commits started together both land, never EEXIST, and a later commit lands on top',
      fn: async function testStartedTogether(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Both commits started together; the hook lock and landing serialize them. */
        const [first, second,] = await Promise.all([
          runWrapper({ repository, args: ['commit', '-m', 'first', 'a.txt',], },),
          runWrapper({ repository, args: ['commit', '-m', 'second', 'b.txt',], },),
        ],);
        /** Codes of every finding. */
        const codes = [...findingCodes(first,), ...findingCodes(second,),];
        expect(first.stderr + second.stderr,).not.toContain('index.lock',);
        // Whichever lands second replays onto the first when both prepared before either landed.
        expect([first.exitCode, second.exitCode,],).toEqual([0, 0,],);
        expect(codes,).toEqual([],);
        /** Commit invoked after both finished, so it prepares on the landed tip. */
        const third = await runWrapper({ repository, args: ['commit', '--no-enforce-only', '--allow-empty', '-m', 'third',], },);
        expect(third.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('third',);
        expect(await git({ repository, args: ['rev-list', '--count', 'HEAD',], },),).toBe('4',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'another invocation\'s staging survives a landing, and the real index never stages a revert',
      fn: async function testRealIndexAtLanding(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'y.txt', content: 'y one\n', },);
        await git({ repository, args: ['add', 'y.txt',], },);
        /** Index commit held in its editor with y at its first content. */
        const held = await holdInEditor({ repository, name: 'index', args: ['commit', '--no-enforce-only', '-e', '-m', 'index',], },);
        await writeWorktreeFile({ repository, name: 'y.txt', content: 'y two\n', },);
        await git({ repository, args: ['add', 'y.txt',], },);
        await writeWorktreeFile({ repository, name: 'c.txt', content: 'c\n', },);
        await git({ repository, args: ['add', 'c.txt',], },);
        await held.release();
        expect((await held.outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', 'HEAD:y.txt',], },),).toBe('y one',);
        expect(await git({ repository, args: ['show', ':y.txt',], },),).toBe('y two',);
        expect(await git({ repository, args: ['diff', '--cached', '--name-only',], },),).toBe('c.txt\ny.txt',);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Explicit-path commit held in its editor. */
        const explicit = await holdInEditor({ repository, name: 'explicit', args: ['commit', '-e', '-m', 'explicit', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'd.txt', content: 'd\n', },);
        await git({ repository, args: ['add', 'd.txt',], },);
        await explicit.release();
        expect((await explicit.outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', '--name-only', '--format=', 'HEAD',], },),).toBe('a.txt',);
        expect(await git({ repository, args: ['diff', '--cached', '--name-only',], },),).toBe('c.txt\nd.txt\ny.txt',);
        expect(await git({ repository, args: ['diff', '--name-only', '--', 'a.txt',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a branch switch between preparation and landing fails with branch-switched',
      fn: async function testBranchSwitched(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit held in its editor. */
        const held = await holdInEditor({ repository, name: 'switch', args: ['commit', '-e', '-m', 'switched', 'a.txt',], },);
        await git({ repository, args: ['switch', '--quiet', '-c', 'other',], },);
        await held.release();
        /** Outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/branch-switched',],);
        expect(await git({ repository, args: ['rev-parse', 'main', 'other',], },),).toBe(`${baseline}\n${baseline}`,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'detaching HEAD between preparation and landing fails with branch-switched even at the same commit',
      fn: async function testDetached(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Commit held in its editor. */
        const held = await holdInEditor({ repository, name: 'detach', args: ['commit', '-e', '-m', 'detached', 'a.txt',], },);
        await git({ repository, args: ['switch', '--quiet', '--detach',], },);
        await held.release();
        /** Outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/branch-switched',],);
        expect(await git({ repository, args: ['rev-parse', 'main', 'HEAD',], },),).toBe(`${baseline}\n${baseline}`,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'an amend whose target moved fails with head-moved',
      fn: async function testAmendMoved(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Amend held in its editor. */
        const held = await holdInEditor({ repository, name: 'amend', args: ['commit', '--amend', '-e', '-m', 'amended',], },);
        /** Commit landing meanwhile. */
        const other = await runWrapper({ repository, args: ['commit', '-m', 'other', 'b.txt',], },);
        expect(other.exitCode,).toBe(0,);
        await held.release();
        /** Amend outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/head-moved',],);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('other\nbaseline',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
