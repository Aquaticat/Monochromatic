/**
 Overlapping commits against one worktree and branch, driven through the built wrapper with editor and hook barriers.

 @module
 */
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  barrierSource,
  createLandingRepository,
  finish,
  git,
  jsonlEvents,
  type LandingRepository,
  leftovers,
  type ProcessOutcome,
  readText,
  runWrapper,
  startWrapper,
  waitForFile,
  writeHook,
  writeNodeProgram,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

/**
 One commit held open in its message editor.
 */
type HeldCommit = Readonly<{
  /**
   Releases the editor.
   */
  release: () => Promise<void>;
  /**
   Outcome after release.
   */
  outcome: Promise<ProcessOutcome>;
}>;

/**
 Starts a wrapper commit whose message editor waits at a barrier, and waits until it is there.

 @param repository - fixture repository

 @param name - barrier name

 @param args - wrapper arguments, which must open the editor

 @returns held commit
 */
async function holdInEditor({
  repository,
  name,
  args,
}: Readonly<{
  repository: LandingRepository;
  name: string;
  args: readonly string[];
}>,): Promise<HeldCommit> {
  /**
   Barrier files.
   */
  const ready = join(repository.scratch, `${name}.ready`,);
  /**
   Release file.
   */
  const release = join(repository.scratch, `${name}.release`,);
  /**
   Editor program.
   */
  const editor = join(repository.scratch, `${name}-editor.cjs`,);
  await writeNodeProgram({ path: editor, source: barrierSource({ ready, release, },), },);
  /**
   Started commit.
   */
  const child = startWrapper({ repository, args, env: { GIT_EDITOR: editor, }, },);
  /**
   Outcome collected from the start.
   */
  const outcome = finish(child,);
  await waitForFile({ path: ready, },);
  return {
    release: async function releaseEditor(): Promise<void> {
      await writeFile(release, '',);
    },
    outcome,
  };
}

/**
 Codes of the core findings in a wrapper outcome.

 @param outcome - wrapper outcome

 @returns finding codes
 */
function findingCodes(outcome: ProcessOutcome,): readonly unknown[] {
  return jsonlEvents(outcome.stderr,)
    .filter(function isCoreFinding(event,): boolean {
      return event.type === 'core-finding';
    },)
    .map(function codeOf(event,): unknown {
      return event.code;
    },);
}

await describe({
  name: 'concurrent commit landing',
  children: [
    it({
      name: 'a commit landing while another waits in its editor wins, and the waiting one fails with head-moved, never EEXIST',
      fn: async function testHeadMoved(): Promise<void> {
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
        expect(firstOutcome.exitCode,).toBe(1,);
        expect(findingCodes(firstOutcome,),).toEqual(['concurrent-commit/head-moved',],);
        expect(firstOutcome.stderr,).not.toContain('index.lock',);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('second\nbaseline',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('?? a.txt',);
        expect(await readText(log,),).toBe('pre-commit\npre-commit\n',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'two commits started together each land or fail with head-moved, never EEXIST, and a later commit lands on top',
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
        // Either both prepared before either landed, or the second prepared after the first landed.
        expect([first.exitCode, second.exitCode,].toSorted(),).toEqual(codes.length === 0 ? [0, 0,] : [0, 1,],);
        expect(codes.every(function isHeadMoved(code,): boolean {
          return code === 'concurrent-commit/head-moved';
        },),).toBe(true,);
        /** Commit invoked after both finished, so it prepares on the landed tip. */
        const third = await runWrapper({ repository, args: ['commit', '--no-enforce-only', '--allow-empty', '-m', 'third',], },);
        expect(third.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('third',);
        expect(await git({ repository, args: ['rev-list', '--count', 'HEAD',], },),).toBe(String(2 + (codes.length === 0 ? 2 : 1),),);
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
