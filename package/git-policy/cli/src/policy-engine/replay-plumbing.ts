/**
 Capability probe for replay plumbing: `git merge-tree --write-tree --merge-base`.

 `--merge-base` first shipped in Git 2.40.0.
 Without it,
 a commit that lost a landing race cannot be replayed,
 and it fails fast with `concurrent-commit/head-moved`,
 the behavior that predates replay.
 The probe exercises the option instead of comparing version strings or reading usage text,
 whose spelling changed from `--merge-base <commit>` (Git 2.40.0) to `--[no-]merge-base <tree-ish>` (Git 2.55.0):
 it merges an existing commit with itself over itself as the base,
 whose result is that commit's own tree,
 so the probe writes no object.
 A Git whose option parser rejects `--merge-base` exits 129,
 the parse-options usage status.
 The probe runs only after a lost race,
 so commits that land on the first attempt never pay for it,
 and its answer is kept per Git executable for the life of the process.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Exit status of Git's option parser for an unknown option.
 */
const USAGE_ERROR_EXIT = 129;

/**
 Probe answers per Git executable, shared by every lost race of this process.
 */
const answers = new Map<string, Promise<boolean>>();

/**
 Asks one Git executable whether its `merge-tree` accepts `--merge-base`.

 @param gitPath - real Git executable

 @param cwd - repository directory holding {@link commit}

 @param commit - existing commit, merged with itself over itself

 @returns whether the option was accepted

 @throws {@link CommitTransactionGitError} when `git merge-tree` fails for another reason than an unknown option
 */
async function probeReplayPlumbing({
  gitPath,
  cwd,
  commit,
}: Readonly<{
  gitPath: string;
  cwd: string;
  commit: string;
}>,): Promise<boolean> {
  /**
   Tagged probe logger.
   */
  const pl = tagged({
    tag: probeReplayPlumbing.name,
    l,
  },);
  /**
   Trivial merge through the option under test.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'merge-tree',
      '--write-tree',
      `--merge-base=${commit}`,
      commit,
      commit,
    ],
    allowFailure: true,
  },);
  if (result.exitCode === 0) {
    pl.debug(`${gitPath} merge-tree accepts --merge-base`,);
    return true;
  }
  if (result.exitCode === USAGE_ERROR_EXIT) {
    pl.debug(`${gitPath} merge-tree rejects --merge-base: ${result.stderr
      .trim()}`,);
    return false;
  }
  throw new CommitTransactionGitError(`git merge-tree --merge-base probe on ${commit} exited ${String(result.exitCode,)}: ${result.stderr
    .trim()}`,);
}

/**
 Reports whether a Git executable can replay a prepared commit onto a moved target.

 @param gitPath - real Git executable

 @param cwd - repository directory holding {@link commit}

 @param commit - existing commit to probe with, such as the target that won the race

 @returns whether `git merge-tree --write-tree --merge-base` is available

 @throws {@link CommitTransactionGitError} when the probe fails for another reason than an unknown option

 @example
 ```ts
 if (!await replayPlumbingAvailable({ gitPath: '/usr/bin/git', cwd: '/repo', commit: winnerOid })) { ... }
 ```
 */
export async function replayPlumbingAvailable({
  gitPath,
  cwd,
  commit,
}: Readonly<{
  gitPath: string;
  cwd: string;
  commit: string;
}>,): Promise<boolean> {
  /**
   Answer already probed or in flight.
   */
  const known = answers.get(gitPath,);
  if (known !== undefined)
    return await known;
  /**
   New probe, stored before it settles so concurrent callers share it.
   */
  const probe = probeReplayPlumbing({
    gitPath,
    cwd,
    commit,
  },);
  answers.set(
    gitPath,
    probe,
  );
  return await probe;
}
