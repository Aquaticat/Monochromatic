/**
 Several commits started at once, initial commits on an unborn branch, and a real `gc --prune=now` during preparation,
 through the built wrapper on disposable repositories.

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
  gitOutcome,
  leftovers,
  runWrapper,
  startWrapper,
  waitForFile,
  writeHook,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventTypes,
  holdInEditor,
} from './commit-landing-replay-fixture.unit.test.ts';

await describe({
  name: 'many concurrent commits',
  children: [
    ...[2, 3, 8,].map(function startedTogether(count,) {
      return it({
        name: `${String(count,)} commits started together each land exactly once with their captured bytes`,
        fn: async function testStartedTogether(): Promise<void> {
          await using repository = await createLandingRepository();
          /** Agent names. */
          const names = Array.from({ length: count, }, function agentName(_value, index,): string {
            return `agent-${String(index,)}`;
          },);
          await Promise.all(names.map(async function writeAgentFile(name,): Promise<void> {
            await writeWorktreeFile({ repository, name: `${name}.txt`, content: `${name} bytes\n`, },);
          },),);
          /** Outcomes of every agent. */
          const outcomes = await Promise.all(names.map(async function commitAgent(name,) {
            return await runWrapper({ repository, args: ['commit', '-m', name, `${name}.txt`,], },);
          },),);
          expect(outcomes.map(function exitOf(outcome,): number {
            return outcome.exitCode;
          },),).toEqual(names.map(function landed(): number {
            return 0;
          },),);
          /** Landed subjects. */
          const subjects = (await git({ repository, args: ['log', '--format=%s',], },)).split('\n',);
          expect(subjects.toSorted(),).toEqual([...names, 'baseline',].toSorted(),);
          /** Each file's landed bytes. */
          const landed = await Promise.all(names.map(async function landedBytes(name,): Promise<string> {
            return await git({ repository, args: ['show', `HEAD:${name}.txt`,], },);
          },),);
          expect(landed,).toEqual(names.map(function capturedBytes(name,): string {
            return `${name} bytes`;
          },),);
          // Every commit carries exactly its own path.
          expect(
            await Promise.all(names.map(async function changedPaths(name,): Promise<string> {
            return await git({ repository, args: ['log', '-1', '--format=', '--name-only', `--grep=^${name}$`,], },);
          },),),
          ).toEqual(names.map(function ownPath(name,): string {
            return `${name}.txt`;
          },),);
          expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
          expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
          expect(await leftovers(repository,),).toEqual([],);
        },
      },);
    },),
    it({
      name: 'two initial commits on an unborn branch both land, the later one replayed onto the first',
      fn: async function testUnborn(): Promise<void> {
        await using repository = await createLandingRepository();
        await git({ repository, args: ['switch', '--quiet', '--orphan', 'fresh',], },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** First initial commit, held in its editor. */
        const held = await holdInEditor({ repository, name: 'first', args: ['commit', '-e', '-m', 'first', 'a.txt',], },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'second', 'b.txt',], },)).exitCode,).toBe(0,);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        expect(await git({ repository, args: ['log', '--format=%s', 'fresh',], },),).toBe('first\nsecond',);
        expect(await git({ repository, args: ['ls-tree', '--name-only', 'fresh',], },),).toBe('a.txt\nb.txt',);
        expect(await git({ repository, args: ['rev-list', '--max-parents=0', 'fresh',], },),).toBe(await git({ repository, args: ['rev-parse', 'fresh~1',], },),);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a real gc --prune=now during preparation keeps every object the commit staged, because they live in the shadow store',
      fn: async function testGcDuringPreparation(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Barrier files. */
        const ready = join(repository.scratch, 'pre-commit.ready',);
        /** Release file. */
        const release = join(repository.scratch, 'pre-commit.release',);
        await writeHook({ repository, event: 'pre-commit', source: barrierSource({ ready, release, },), },);
        await writeWorktreeFile({ repository, name: 'held.txt', content: 'bytes only this commit stages\n', },);
        /** Blob the commit stages. */
        const blob = await git({ repository, args: ['hash-object', 'held.txt',], },);
        /** Commit held in pre-commit. */
        const outcome = finish(startWrapper({ repository, args: ['commit', '-m', 'held', 'held.txt',], },),);
        await waitForFile({ path: ready, },);
        // The staged blob is not in the real object store, so a real prune cannot reach it.
        expect((await gitOutcome({ repository, args: ['cat-file', '-e', blob,], },)).exitCode,).not.toBe(0,);
        await git({ repository, args: ['gc', '--quiet', '--prune=now',], },);
        await writeFile(release, '',);
        expect((await outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['rev-parse', 'HEAD:held.txt',], },),).toBe(blob,);
        expect((await gitOutcome({ repository, args: ['fsck', '--strict', '--no-dangling',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
