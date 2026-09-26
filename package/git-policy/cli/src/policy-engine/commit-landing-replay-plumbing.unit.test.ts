/**
 A commit that needs replay on a Git without replay plumbing fails fast with `concurrent-commit/head-moved`.

 Git before 2.40.0 has no `git merge-tree --merge-base`.
 The decision degrades that per feature:
 such a commit fails without landing,
 the fail-fast behavior that predates replay,
 while commits that need no replay land as before.
 A Node program named `git`, first on `PATH`, stands in for such a Git:
 it answers `git merge-tree -h` and `--merge-base` exactly as Git 2.39.5 does and forwards everything else.
 The container suite runs the same case on a real Git 2.39.5.

 @module
 */
import {
  dirname,
  join,
} from 'node:path';
import {
  mkdir,
  symlink,
} from 'node:fs/promises';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLandingRepository,
  git,
  type LandingRepository,
  leftovers,
  readText,
  REAL_GIT,
  runWrapper,
  writeNodeProgram,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import {
  eventOfType,
  eventTypes,
  findingCodes,
  holdInEditor,
} from './commit-landing-replay-fixture.unit.test.ts';

/**
 `git merge-tree -h` usage printed by Git 2.39.5, which lists no `--merge-base`.
 */
const MERGE_TREE_USAGE_2_39 = `usage: git merge-tree [--write-tree] [<options>] <branch1> <branch2>
   or: git merge-tree [--trivial-merge] <base-tree> <branch1> <branch2>

    --write-tree          do a real merge instead of a trivial merge
    --trivial-merge       do a trivial merge only
    --messages            also show informational/conflict messages
    -z                    separate paths with the NUL character
    --name-only           list filenames without modes/oids/stages
    --allow-unrelated-histories
                          allow merging unrelated histories
    --stdin               perform multiple merges, one per line of input

`;

/**
 Installs a Git without replay plumbing and returns the `PATH` that selects it.

 @param repository - fixture repository

 @returns environment entries selecting the emulated Git
 */
async function withoutReplayPlumbing(repository: LandingRepository,): Promise<Readonly<{ PATH: string; }>> {
  /**
   Directory holding the emulated `git`.
   */
  const directory = join(repository.scratch, 'git-2.39',);
  await mkdir(directory,);
  await writeNodeProgram({
    path: join(directory, 'git',),
    source: `const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const mergeTree = args.indexOf('merge-tree');
if (mergeTree !== -1) {
  const rest = args.slice(mergeTree + 1);
  const option = rest.find(function isMergeBase(arg) { return arg.startsWith('--merge-base'); });
  if (rest.includes('-h') || (option !== undefined)) {
    if (option !== undefined) process.stderr.write('error: unknown option \`' + option.slice(2) + "'\\n");
    process.stdout.write(${JSON.stringify(MERGE_TREE_USAGE_2_39,)});
    process.exit(129);
  }
}
const result = spawnSync(${JSON.stringify(REAL_GIT,)}, args, { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);`,
  },);
  /**
   System tools (`findmnt`, `stat`) under a spelling other than their own directory:
   the real-Git resolver promotes /usr/bin/git ahead of PATH order whenever PATH names /usr/bin literally.
   */
  const systemTools = join(repository.scratch, 'system-tools',);
  await symlink(dirname(REAL_GIT,), systemTools,);
  return { PATH: `${directory}:${systemTools}:${dirname(process.execPath,)}`, };
}

await describe({
  name: 'replay on a Git without replay plumbing',
  children: [
    it({
      name: 'a commit that needs no replay lands',
      fn: async function testNoReplay(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Environment selecting the emulated Git. */
        const env = await withoutReplayPlumbing(repository,);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await git({ repository, args: ['add', 'a.txt',], },);
        /** Plain commit. */
        const outcome = await runWrapper({ repository, args: ['commit', '--quiet', '-m', 'plain', 'a.txt',], env, },);
        expect({ exitCode: outcome.exitCode, stderr: outcome.stderr, },).toEqual({ exitCode: 0, stderr: '', },);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('plain',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'a commit that lost the landing race fails with head-moved naming the missing option, and nothing changes',
      fn: async function testReplayUnavailable(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Environment selecting the emulated Git. */
        const env = await withoutReplayPlumbing(repository,);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        await git({ repository, args: ['add', 'a.txt', 'b.txt',], },);
        /** Commit of `a.txt`, held in its editor so the other commit lands first. */
        const held = await holdInEditor({ repository, name: 'mine', args: ['commit', '-e', '-m', 'mine', 'a.txt',], env, },);
        /** Commit of `b.txt`, landing first. */
        const theirs = await runWrapper({ repository, args: ['commit', '--quiet', '-m', 'theirs', 'b.txt',], env, },);
        expect(theirs.exitCode,).toBe(0,);
        /** Winning commit. */
        const winner = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await held.release();
        /** Outcome of the commit that needed replay. */
        const outcome = await held.outcome;
        expect({ exitCode: outcome.exitCode, events: eventTypes(outcome,), findings: findingCodes(outcome,), },).toEqual({
          exitCode: 1,
          events: ['core-finding',],
          findings: ['concurrent-commit/head-moved',],
        },);
        expect(String(eventOfType({ outcome, type: 'core-finding', },).message,),).toContain('--merge-base',);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(winner,);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('A  a.txt',);
        expect(
          await readText(join(repository.path, 'a.txt',),),
        ).toBe('a\n',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
