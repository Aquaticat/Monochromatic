/**
 Replay after a lost landing race, and revalidation of the replayed tree, through the built wrapper on disposable repositories.

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
  createLandingRepository,
  git,
  gitOutcome,
  leftovers,
  readText,
  REAL_GIT,
  runWrapper,
  writeHook,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  configureSshSigning,
  eventOfType,
  eventTypes,
  findingCodes,
  gitBytes,
  holdInEditor,
  numberedLines,
  stageContent,
} from './commit-landing-replay-fixture.unit.test.ts';

/**
 Latin-1 message bytes: `café` and a newline.
 */
const LATIN1_MESSAGE = Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A,],);

/**
 Hook body appending the tree of the index it sees.

 @param log - log file

 @returns CommonJS statements
 */
function treeLogSource(log: string,): string {
  return `const tree = require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['write-tree'], { encoding: 'utf8' }).trim();
require('node:fs').appendFileSync(${JSON.stringify(log,)}, tree + '\\n');`;
}

await describe({
  name: 'commit replay',
  children: [
    it({
      name: 'non-overlapping hunks in one file replay cleanly onto the commit that won',
      fn: async function testNonOverlapping(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({},), },);
        await git({ repository, args: ['add', 'f.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'lines',], },);
        /** Base of both commits. */
        const base = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 1: 'mine', },), },);
        /** Commit of the first hunk, held in its editor. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'f.txt',], },);
        await stageContent({ repository, path: 'f.txt', content: numberedLines({ 10: 'theirs', },), },);
        /** Index commit of the last hunk, landing first. */
        const theirs = await runWrapper({ repository, args: ['commit', '--no-only', '-m', 'theirs',], },);
        expect(theirs.exitCode,).toBe(0,);
        /** Winning commit. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        expect(eventOfType({ outcome, type: 'landing-race-lost', },),).toMatchObject({ attempt: 1, winningOid: winner, },);
        expect(eventOfType({ outcome, type: 'commit-replayed', },),).toMatchObject({ fromBase: base, onto: winner, oid: await git({ repository, args: ['rev-parse', 'HEAD',], },), },);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(winner,);
        expect(`${await git({ repository, args: ['show', 'HEAD:f.txt',], },)}\n`,).toBe(numberedLines({ 1: 'mine', 10: 'theirs', },),);
        // The real index takes the landed tree for the committed path; the worktree keeps its own bytes.
        expect(`${await git({ repository, args: ['show', ':f.txt',], },)}\n`,).toBe(numberedLines({ 1: 'mine', 10: 'theirs', },),);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('M f.txt',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'overlapping hunks fail with replay-conflict, leave ref, index, and worktree exact, and keep the prepared commit for cherry-picking',
      fn: async function testConflict(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({},), },);
        await git({ repository, args: ['add', 'f.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'lines',], },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 1: 'mine', },), },);
        /** Held commit. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'f.txt',], },);
        await stageContent({ repository, path: 'f.txt', content: numberedLines({ 1: 'theirs', },), },);
        expect((await runWrapper({ repository, args: ['commit', '--no-only', '-m', 'theirs',], },)).exitCode,).toBe(0,);
        /** Winning commit. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Real index bytes before the conflicting landing. */
        const indexBefore = gitBytes({ repository, args: ['ls-files', '--stage',], },);
        await held.release();
        /** Conflicted outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(findingCodes(outcome,),).toEqual(['concurrent-commit/replay-conflict',],);
        /** Conflict finding. */
        const finding = eventOfType({ outcome, type: 'core-finding', },);
        expect(finding,).toMatchObject({ paths: ['f.txt',], winningOid: winner, },);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(winner,);
        expect(Buffer.compare(indexBefore, gitBytes({ repository, args: ['ls-files', '--stage',], },),),).toBe(0,);
        expect(
          await readText(join(repository.path, 'f.txt',),),
        ).toBe(numberedLines({ 1: 'mine', },),);
        expect(await leftovers(repository,),).toEqual([],);
        /** Prepared commit named by the finding. */
        const prepared = String(finding.preparedOid,);
        expect(`${await git({ repository, args: ['show', `${prepared}:f.txt`,], },)}\n`,).toBe(numberedLines({ 1: 'mine', },),);
        expect(await git({ repository, args: ['log', '-1', '--format=%s', prepared,], },),).toBe('mine',);
      },
    },),
    it({
      name: 'an SSH-signed commit replays re-signed under its original identities and dates',
      fn: async function testSignedReplay(): Promise<void> {
        await using repository = await createLandingRepository();
        await configureSshSigning(repository,);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Signed commit held in its editor. */
        const held = await holdInEditor({ repository, name: 'signed', args: ['commit', '-S', '-e', '-m', 'signed', 'a.txt',], },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'other', 'b.txt',], },)).exitCode,).toBe(0,);
        /** Winning commit. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toEqual(['landing-race-lost', 'commit-replayed',],);
        /** Replayed commit object. */
        const raw = await git({ repository, args: ['cat-file', 'commit', 'HEAD',], },);
        expect(raw,).toContain(`parent ${winner}\n`,);
        expect(raw,).toContain('author cli-git landing fixture <landing@example.invalid> 1700000000 +0000\n',);
        expect(raw,).toContain('committer cli-git landing fixture <landing@example.invalid> 1700000000 +0000\n',);
        expect(raw,).toContain('gpgsig -----BEGIN SSH SIGNATURE-----',);
        expect((await gitOutcome({ repository, args: ['verify-commit', 'HEAD',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    ...([false, true,] as const).map(function encodingTest(signed,) {
      return it({
        name: `a non-UTF-8 ${signed ? 'signed' : 'unsigned'} commit replays with its encoding header and exact message bytes`,
        fn: async function testEncoding(): Promise<void> {
          await using repository = await createLandingRepository();
          if (signed)
            await configureSshSigning(repository,);
          /** Latin-1 message file. */
          const message = join(repository.scratch, 'message.txt',);
          await writeFile(message, LATIN1_MESSAGE,);
          await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
          await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
          /** Held commit with a Latin-1 message. */
          const held = await holdInEditor({
            repository,
            name: 'latin1',
            args: ['-c', 'i18n.commitEncoding=ISO-8859-1', 'commit', ...(signed ? ['-S',] : []), '-e', '-F', message, 'a.txt',],
          },);
          expect((await runWrapper({ repository, args: ['commit', '-m', 'other', 'b.txt',], },)).exitCode,).toBe(0,);
          await held.release();
          expect((await held.outcome).exitCode,).toBe(0,);
          /** Replayed commit bytes. */
          const raw = gitBytes({ repository, args: ['cat-file', 'commit', 'HEAD',], },);
          expect(raw.includes('\nencoding ISO-8859-1\n',),).toBe(true,);
          expect(Buffer.compare(raw.subarray(raw.length - LATIN1_MESSAGE.length,), LATIN1_MESSAGE,),).toBe(0,);
          expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('café',);
          if (signed)
            expect((await gitOutcome({ repository, args: ['verify-commit', 'HEAD',], },)).exitCode,).toBe(0,);
          expect(await leftovers(repository,),).toEqual([],);
        },
      },);
    },),
    it({
      name: 'revalidation re-runs policies and pre-commit against the replayed tree, and the policy fix lands',
      fn: async function testRevalidation(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({},), },);
        await git({ repository, args: ['add', 'f.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'lines',], },);
        /** Trees pre-commit saw. */
        const log = join(repository.scratch, 'trees.log',);
        await writeHook({ repository, event: 'pre-commit', source: treeLogSource(log,), },);
        await writeWorktreeFile({ repository, name: 'f.txt', content: numberedLines({ 1: 'mine', },), },);
        /** Held commit. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'f.txt',], },);
        // A commit made outside the wrapper drops the final newline, which the final-newline policy restores.
        await stageContent({ repository, path: 'f.txt', content: numberedLines({ 10: 'theirs', },).slice(0, -1,), },);
        await git({ repository, args: ['commit', '--quiet', '--no-verify', '-m', 'theirs',], },);
        await held.release();
        /** Replayed outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(eventTypes(outcome,),).toContain('commit-replayed',);
        expect(eventOfType({ outcome, type: 'fix-summary', },),).toMatchObject({ changedPaths: ['f.txt',], },);
        expect(gitBytes({ repository, args: ['show', 'HEAD:f.txt',], },).toString('utf8',),).toBe(numberedLines({ 1: 'mine', 10: 'theirs', },),);
        /** Trees pre-commit saw: the prepared tree, then the fixed replayed tree. */
        const trees = (await readText(log,)).trim().split('\n',);
        expect(trees.length,).toBe(2,);
        expect(trees[0],).not.toBe(trees[1],);
        expect(trees[1],).toBe(await git({ repository, args: ['rev-parse', 'HEAD^{tree}',], },),);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a pre-commit hook that rejects the replayed tree lands nothing and exits 1',
      fn: async function testRejectedReplay(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeHook({
          repository,
          event: 'pre-commit',
          source: `if (require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['ls-files', 'forbidden.txt'], { encoding: 'utf8' }).trim() !== '') process.exit(1);`,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Held commit. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'a.txt',], },);
        await writeWorktreeFile({ repository, name: 'forbidden.txt', content: 'forbidden\n', },);
        await git({ repository, args: ['add', 'forbidden.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '--no-verify', '-m', 'forbidden',], },);
        /** Winning commit. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await held.release();
        /** Rejected outcome. */
        const outcome = await held.outcome;
        expect(outcome.exitCode,).toBe(1,);
        expect(eventTypes(outcome,),).toEqual([],);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(winner,);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('?? a.txt',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a replayed --no-verify commit does not re-run pre-commit',
      fn: async function testNoVerifyReplay(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Pre-commit run log. */
        const log = join(repository.scratch, 'trees.log',);
        await writeHook({ repository, event: 'pre-commit', source: treeLogSource(log,), },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        /** Held commit that bypasses hooks. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '--no-verify', '-e', '-m', 'mine', 'a.txt',], },);
        expect((await runWrapper({ repository, args: ['commit', '-m', 'other', 'b.txt',], },)).exitCode,).toBe(0,);
        await held.release();
        expect((await held.outcome).exitCode,).toBe(0,);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('mine\nother\nbaseline',);
        // Only the other commit's preparation ran pre-commit.
        expect((await readText(log,)).trim().split('\n',).length,).toBe(1,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
