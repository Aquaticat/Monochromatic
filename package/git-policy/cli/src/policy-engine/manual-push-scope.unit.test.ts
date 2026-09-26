/**
 Manual-push scan-scope and process-bound regression tests.

 A new branch or tag must scan only commits its destination remote does not
 already have, an empty remote must scan the pushed tip's final tree once,
 and per-commit deltas must come from a bounded number of Git processes
 regardless of history length.

 @module
 */
import {
  type ChildProcess,
  spawn,
  type SpawnOptions,
} from 'node:child_process';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import {
  createRequire,
  syncBuiltinESMExports,
} from 'node:module';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import type { CandidateFile, } from '../api/policy-types.ts';
import { createManualPushCandidates, } from './manual-push-candidates.ts';
import { parseRawDiffRecords, } from './raw-diff-records.ts';

//region Fixture constants

/**
 Real Git executable used by fixtures and the code under test.
 */
const REAL_GIT = '/usr/bin/git';
/**
 History length large enough that one process per commit is unmistakable.
 */
const LONG_HISTORY_COMMITS = 300;
/**
 Distinct files rewritten round-robin across the long history.
 */
const LONG_HISTORY_FILES = 32;
/**
 Commit count for short histories, below the file rotation so each commit adds one file.
 */
const SHORT_HISTORY_COMMITS = 6;
/**
 Upper bound on Git processes one single-update candidate scan may spawn,
 independent of history length.
 */
const MAX_SCAN_SPAWNS = 8;
/**
 Upper bound on simultaneously live Git processes during one scan.
 */
const MAX_CONCURRENT_SPAWNS = 2;
/**
 Deterministic fast-import commit timestamp base.
 */
const EPOCH_BASE = 1_700_000_000;
/**
 Absent-object ID used as a remote value Git never fetched locally.
 */
const UNFETCHED_REMOTE_OID = 'f'.repeat(40,);
/**
 Gitlink commit recorded for the submodule entry before update.
 */
const GITLINK_BEFORE = '1'.repeat(40,);
/**
 Gitlink commit recorded for the submodule entry after update.
 */
const GITLINK_AFTER = '2'.repeat(40,);

//endregion Fixture constants

//region Spawn recording

/**
 Node child-process module exports whose `spawn` property the ESM bindings mirror.
 */
const childProcessExports = createRequire(import.meta.url,)('node:child_process',) as { spawn: typeof spawn };

/**
 One observed Git process launch.
 */
type SpawnRecord = Readonly<{
  /**
   Exact Git arguments.
   */
  args: readonly string[];
}>;

/**
 Live view over spawns launched in one fixture repository.
 */
type SpawnRecorder = Readonly<{
  /**
   Launches observed so far, in launch order.
   */
  records: readonly SpawnRecord[];
  /**
   Highest simultaneous live process count observed.
   */
  peak: () => number;
  /**
   Restores original spawn implementation.
   */
  [Symbol.dispose]: () => void;
}>;

/**
 Counts every child process launched with the fixture repository as cwd.

 Replaces the CommonJS export and re-synchronizes builtin ESM bindings so
 both `nano-spawn` and direct `node:child_process` imports are observed
 in-process, without adding a wrapper process per Git call.

 @param repository - fixture repository whose launches are counted

 @returns disposable recorder
 */
function recordSpawns(repository: string,): SpawnRecorder {
  /**
   Original implementation restored on dispose.
   */
  const originalSpawn = childProcessExports.spawn;
  /**
   Mutable recorder state shared with the replacement.
   */
  const state: {
    records: SpawnRecord[];
    active: number;
    peak: number;
  } = {
    records: [],
    active: 0,
    peak: 0,
  };
  childProcessExports.spawn = function countingSpawn(
    this: unknown,
    command: string,
    args: readonly string[],
    options: SpawnOptions,
  ): ChildProcess {
    /**
     Real child process.
     */
    const child = Reflect.apply(
      originalSpawn,
      this,
      [command, args, options,],
    ) as ChildProcess;
    if ((options.cwd !== undefined) && (resolve(String(options.cwd,),) === repository)) {
      state.records.push({ args: [...args,], },);
      state.active += 1;
      state.peak = Math.max(state.peak, state.active,);
      child.once('close', function settle() {
        state.active -= 1;
      },);
    }
    return child;
  } as typeof spawn;
  syncBuiltinESMExports();
  return {
    records: state.records,
    peak(): number {
      return state.peak;
    },
    [Symbol.dispose](): void {
      childProcessExports.spawn = originalSpawn;
      syncBuiltinESMExports();
    },
  };
}

/**
 Counts recorded launches of one Git subcommand.

 @param recorder - spawn recorder

 @param subcommand - first Git argument

 @returns launch count
 */
function countSubcommand({
  recorder,
  subcommand,
}: Readonly<{
  recorder: SpawnRecorder;
  subcommand: string;
}>,): number {
  return recorder.records.filter(function isSubcommand(record,) {
    return record.args[0] === subcommand;
  },).length;
}

//endregion Spawn recording

//region Repository fixtures

/**
 Disposable repository root.
 */
type RepositoryFixture = Readonly<{
  /**
   Fixture root holding repository and optional bare remote.
   */
  root: string;
  /**
   Non-bare Git repository.
   */
  repository: string;
  /**
   Removes complete fixture.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Runs real Git in one directory and returns trimmed stdout.

 @param cwd - working directory

 @param args - exact Git arguments

 @param input - optional stdin text

 @returns trimmed stdout
 */
async function git({
  cwd,
  args,
  input,
}: Readonly<{
  cwd: string;
  args: readonly string[];
  input?: string;
}>,): Promise<string> {
  return (await nanoSpawn(
    REAL_GIT,
    args,
    {
      cwd,
      stdio: [
        input === undefined ? 'ignore' : { string: input, },
        'pipe',
        'pipe',
      ],
    },
  )).stdout;
}

/**
 Creates empty repository with deterministic identity.

 @returns disposable repository fixture
 */
async function createRepository(): Promise<RepositoryFixture> {
  /**
   Disposable fixture root.
   */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-manual-scope-',),);
  /**
   Repository inside fixture root.
   */
  const repository = join(root, 'repository',);
  await git({ cwd: root, args: ['init', '--quiet', '--initial-branch=main', repository,], },);
  await git({ cwd: repository, args: ['config', 'user.email', 'fixture@example.invalid',], },);
  await git({ cwd: repository, args: ['config', 'user.name', 'Fixture',], },);
  return {
    root,
    repository,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 One fast-import file change.
 */
type FileChange = Readonly<{
  /**
   Change kind.
   */
  kind: 'modify';
  /**
   Git tree mode.
   */
  mode: '100644' | '100755' | '120000';
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Inline content.
   */
  content: string;
}> | Readonly<{
  /**
   Gitlink change kind.
   */
  kind: 'gitlink';
  /**
   Repository-relative submodule path.
   */
  path: string;
  /**
   Recorded submodule commit.
   */
  oid: string;
}> | Readonly<{
  /**
   Deletion change kind.
   */
  kind: 'delete';
  /**
   Deleted path.
   */
  path: string;
}> | Readonly<{
  /**
   Rename change kind.
   */
  kind: 'rename';
  /**
   Source path.
   */
  from: string;
  /**
   Destination path.
   */
  to: string;
}>;

/**
 Renders one fast-import data block with exact byte length.

 @param content - inline text

 @returns data command
 */
function dataBlock(content: string,): string {
  return `data ${String(Buffer.byteLength(content,),)}\n${content}\n`;
}

/**
 Renders one fast-import file command.

 @param change - file change

 @returns file command text
 */
function fileCommand(change: FileChange,): string {
  if (change.kind === 'modify')
    return `M ${change.mode} inline ${change.path}\n${dataBlock(change.content,)}`;
  if (change.kind === 'gitlink')
    return `M 160000 ${change.oid} ${change.path}\n`;
  if (change.kind === 'delete')
    return `D ${change.path}\n`;
  return `R ${change.from} ${change.to}\n`;
}

/**
 Renders one fast-import commit command.

 @param ref - branch ref receiving commit

 @param mark - fast-import mark number

 @param from - first parent mark or ref, absent for root commits

 @param merges - additional parent marks

 @param changes - file changes against first parent

 @returns commit command text
 */
function commitCommand({
  ref,
  mark,
  from,
  merges,
  changes,
}: Readonly<{
  ref: string;
  mark: number;
  from?: string;
  merges?: readonly number[];
  changes: readonly FileChange[];
}>,): string {
  return [
    `commit ${ref}\n`,
    `mark :${String(mark,)}\n`,
    `committer Fixture <fixture@example.invalid> ${String(EPOCH_BASE + mark,)} +0000\n`,
    dataBlock(`commit ${String(mark,)}`,),
    from === undefined ? '' : `from ${from}\n`,
    ...(merges ?? []).map(function mergeCommand(parent,) {
      return `merge :${String(parent,)}\n`;
    },),
    ...changes.map(fileCommand,),
    '\n',
  ].join('',);
}

/**
 Imports one complete fast-import stream through a single Git process.

 @param repository - destination repository

 @param stream - fast-import commands
 */
async function fastImport({
  repository,
  stream,
}: Readonly<{
  repository: string;
  stream: string;
}>,): Promise<void> {
  await git({ cwd: repository, args: ['fast-import', '--quiet',], input: stream, },);
  await git({ cwd: repository, args: ['reset', '--quiet', '--hard', 'main',], },);
}

/**
 Builds linear main history rewriting files round-robin.

 @param commits - commit count

 @returns fast-import stream
 */
function linearHistory(commits: number,): string {
  return Array.from({ length: commits, }, function commitAt(_unused, index,) {
    return commitCommand({
      ref: 'refs/heads/main',
      mark: index + 1,
      ...(index === 0 ? {} : { from: `:${String(index,)}`, }),
      changes: [{
        kind: 'modify',
        mode: '100644',
        path: `file-${String(index % LONG_HISTORY_FILES,)}.txt`,
        content: `revision ${String(index,)}\n`,
      },],
    },);
  },).join('',);
}

/**
 Appends commits on one branch starting at an existing ref.

 @param ref - branch receiving commits

 @param start - existing start revision

 @param firstMark - first unused mark

 @param paths - one new file path per commit

 @returns fast-import stream
 */
function branchCommits({
  ref,
  start,
  firstMark,
  paths,
}: Readonly<{
  ref: string;
  start: string;
  firstMark: number;
  paths: readonly string[];
}>,): string {
  return paths.map(function commitAt(path, index,) {
    return commitCommand({
      ref,
      mark: firstMark + index,
      from: index === 0 ? start : `:${String(firstMark + index - 1,)}`,
      changes: [{ kind: 'modify', mode: '100644', path, content: `${path}\n`, },],
    },);
  },).join('',);
}

/**
 Mixed history covering roots, merges, renames, deletions, type changes,
 executables, symlinks, gitlinks, and an empty commit.
 */
const MIXED_HISTORY = [
  commitCommand({
    ref: 'refs/heads/main',
    mark: 1,
    changes: [
      { kind: 'modify', mode: '100644', path: 'a.txt', content: 'a0\n', },
      { kind: 'modify', mode: '100644', path: 'b.txt', content: 'b0\n', },
      { kind: 'modify', mode: '100755', path: 'exec.sh', content: 'run\n', },
      { kind: 'modify', mode: '120000', path: 'link', content: 'a.txt', },
      { kind: 'gitlink', path: 'sub', oid: GITLINK_BEFORE, },
    ],
  },),
  commitCommand({
    ref: 'refs/heads/main',
    mark: 2,
    from: ':1',
    changes: [
      { kind: 'modify', mode: '100644', path: 'a.txt', content: 'a1\n', },
      { kind: 'delete', path: 'b.txt', },
      { kind: 'rename', from: 'exec.sh', to: 'tools/exec.sh', },
    ],
  },),
  commitCommand({
    ref: 'refs/heads/side',
    mark: 3,
    from: ':1',
    changes: [
      { kind: 'modify', mode: '100644', path: 'side.txt', content: 'side\n', },
      { kind: 'modify', mode: '100644', path: 'a.txt', content: 'a-side\n', },
    ],
  },),
  commitCommand({
    ref: 'refs/heads/other',
    mark: 4,
    changes: [{ kind: 'modify', mode: '100644', path: 'other.txt', content: 'other\n', },],
  },),
  commitCommand({
    ref: 'refs/heads/main',
    mark: 5,
    from: ':2',
    merges: [3, 4,],
    changes: [
      { kind: 'modify', mode: '100644', path: 'a.txt', content: 'a-merged\n', },
      { kind: 'modify', mode: '100644', path: 'side.txt', content: 'side\n', },
      { kind: 'modify', mode: '100644', path: 'other.txt', content: 'other\n', },
    ],
  },),
  commitCommand({
    ref: 'refs/heads/main',
    mark: 6,
    from: ':5',
    changes: [
      { kind: 'modify', mode: '100644', path: 'link', content: 'now a file\n', },
      { kind: 'gitlink', path: 'sub', oid: GITLINK_AFTER, },
    ],
  },),
  commitCommand({ ref: 'refs/heads/main', mark: 7, from: ':6', changes: [], },),
].join('',);

//endregion Repository fixtures

//region Candidate comparison

/**
 Comparable candidate identity without lazy byte provider.
 */
type CandidateSummary = Readonly<{
  /**
   Invocation-local identity.
   */
  targetId: string;
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Git object identity.
   */
  revision: string;
  /**
   Candidate mode.
   */
  mode: string;
  /**
   Change classification.
   */
  change: string;
}>;

/**
 Drops lazy byte providers so candidates compare structurally.

 @param candidates - materialized candidates

 @returns comparable summaries in original order
 */
function summarize(candidates: readonly CandidateFile[],): readonly CandidateSummary[] {
  return candidates.map(function toSummary(candidate,) {
    return {
      targetId: candidate.targetId,
      path: candidate.path,
      revision: candidate.revision,
      mode: candidate.mode,
      change: candidate.change,
    };
  },);
}

/**
 Computes pre-refactor per-commit candidates independently, one diff-tree per commit.

 @param repository - fixture repository

 @param commits - commits in scan order

 @param targetBase - remote name and ref prefix

 @returns expected summaries
 */
async function referenceSummaries({
  repository,
  commits,
  targetBase,
}: Readonly<{
  repository: string;
  commits: readonly string[];
  targetBase: string;
}>,): Promise<readonly CandidateSummary[]> {
  /**
   Sequential per-commit raw diffs; fixture ranges stay short.
   */
  const perCommit: (readonly CandidateSummary[])[] = [];
  /* oxlint-disable no-await-in-loop -- Reference implementation deliberately mirrors one process per commit, sequentially. */
  for (const commit of commits) {
    /**
     Raw diff of one commit against every parent.
     */
    const raw = (await nanoSpawn(
      REAL_GIT,
      ['diff-tree', '--root', '--no-commit-id', '-r', '-z', '-m', commit,],
      { cwd: repository, },
    )).stdout;
    perCommit.push(parseRawDiffRecords({
      text: raw,
      createError: function toError(message,) { return new Error(message,); },
    },).map(function toSummary(record,) {
      return {
        targetId: `${targetBase}:${commit}:${record.oid}:${record.path}`,
        path: record.path,
        revision: record.oid,
        mode: record.mode,
        change: record.change,
      };
    },),);
  }
  /* oxlint-enable no-await-in-loop */
  return perCommit.flat();
}

/**
 Lists commits reachable from tip but not from exclusions, oldest first.

 @param repository - fixture repository

 @param tip - range tip

 @param exclusions - excluded revisions

 @returns commit IDs
 */
async function rangeCommits({
  repository,
  tip,
  exclusions,
}: Readonly<{
  repository: string;
  tip: string;
  exclusions: readonly string[];
}>,): Promise<readonly string[]> {
  return (await git({
    cwd: repository,
    args: ['rev-list', '--reverse', tip, ...exclusions.map(function exclude(oid,) { return `^${oid}`; },),],
  },))
    .split('\n',)
    .filter(function nonEmpty(line,) { return line.length > 0; },);
}

/**
 Builds a new-ref push update.

 @param localOid - pushed local object

 @param remoteRef - destination ref

 @param remoteName - destination remote name

 @param remoteOid - authoritative prior destination value

 @returns push update
 */
function pushUpdate({
  localOid,
  remoteRef,
  remoteName = 'origin',
  remoteOid = ABSENT_GIT_VALUE,
}: Readonly<{
  localOid: string;
  remoteRef: string;
  remoteName?: string;
  remoteOid?: PushUpdate['remoteOid'];
}>,): PushUpdate {
  return { localOid, remoteOid, remoteName, remoteRef, };
}

//endregion Candidate comparison

await describe({
  name: 'manual-push scan scope',
  // Spawn recording replaces a process-wide export; tests must not overlap.
  concurrency: 1,
  children: [
    //region Published-history exclusion

    it({
      name: 'new branch push scans only commits the bare remote lacks',
      fn: async function testNewBranchExcludesPublished() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(SHORT_HISTORY_COMMITS,), },);
        /**
         Local bare destination.
         */
        const remote = join(fixture.root, 'remote.git',);
        await git({ cwd: fixture.root, args: ['init', '--bare', '--quiet', remote,], },);
        await git({ cwd: fixture.repository, args: ['remote', 'add', 'origin', remote,], },);
        await git({ cwd: fixture.repository, args: ['push', '--quiet', 'origin', 'main',], },);
        await fastImport({
          repository: fixture.repository,
          stream: branchCommits({
            ref: 'refs/heads/feature',
            start: 'refs/heads/main^0',
            firstMark: 1,
            paths: ['feature-1.txt', 'feature-2.txt',],
          },),
        },);
        /**
         Feature tip pushed as new remote branch.
         */
        const featureTip = await git({ cwd: fixture.repository, args: ['rev-parse', 'refs/heads/feature',], },);
        /**
         Candidates for new branch.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: featureTip, remoteRef: 'refs/heads/feature', },),],
        },);
        expect(summarize(candidates,),).toEqual(await referenceSummaries({
          repository: fixture.repository,
          commits: await rangeCommits({ repository: fixture.repository, tip: featureTip, exclusions: ['main',], },),
          targetBase: 'manual-push:origin:refs/heads/feature',
        },),);
        expect(candidates.map(function pathOf(candidate,) { return candidate.path; },),)
          .toEqual(['feature-1.txt', 'feature-2.txt',],);
      },
    },),
    it({
      name: 'tag push of an already-published commit scans nothing',
      fn: async function testPublishedTag() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(SHORT_HISTORY_COMMITS,), },);
        /**
         Local bare destination.
         */
        const remote = join(fixture.root, 'remote.git',);
        await git({ cwd: fixture.root, args: ['init', '--bare', '--quiet', remote,], },);
        await git({ cwd: fixture.repository, args: ['remote', 'add', 'origin', remote,], },);
        await git({ cwd: fixture.repository, args: ['push', '--quiet', 'origin', 'main',], },);
        await git({ cwd: fixture.repository, args: ['tag', '--annotate', '--message', 'v1', 'v1', 'main~2',], },);
        /**
         Annotated tag object pushed as new remote tag.
         */
        const tagOid = await git({ cwd: fixture.repository, args: ['rev-parse', 'refs/tags/v1',], },);
        using recorder = recordSpawns(fixture.repository,);
        /**
         Candidates for published tag target.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: tagOid, remoteRef: 'refs/tags/v1', },),],
        },);
        expect(candidates,).toHaveLength(0,);
        expect(countSubcommand({ recorder, subcommand: 'diff-tree', },),).toBe(0,);
      },
    },),
    it({
      name: 'tracking refs of another remote do not count as published',
      fn: async function testOtherRemoteTracking() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(SHORT_HISTORY_COMMITS,), },);
        /**
         Local tip.
         */
        const tip = await git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },);
        await git({ cwd: fixture.repository, args: ['update-ref', 'refs/remotes/origin/main', tip,], },);
        /**
         Candidates for first push to a different remote.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: tip, remoteRef: 'refs/heads/main', remoteName: 'mirror', },),],
        },);
        // Nothing is known on `mirror`, so its tip tree is scanned once.
        expect(candidates,).toHaveLength(SHORT_HISTORY_COMMITS,);
        expect(candidates.every(function isAdded(candidate,) { return candidate.change === 'added'; },),).toBe(true,);
        expect(candidates.every(function isTipTarget(candidate,) {
          return candidate.targetId.startsWith(`manual-push:mirror:refs/heads/main:${tip}:`,);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'unfetched remote OID is skipped while tracking refs still exclude',
      fn: async function testUnfetchedRemoteOid() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(SHORT_HISTORY_COMMITS,), },);
        await git({ cwd: fixture.repository, args: ['update-ref', 'refs/remotes/origin/main', 'main~1',], },);
        /**
         Local tip one commit ahead of tracking ref.
         */
        const tip = await git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },);
        /**
         Candidates for force push over history Git never fetched.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({
            localOid: tip,
            remoteRef: 'refs/heads/main',
            remoteOid: UNFETCHED_REMOTE_OID,
          },),],
        },);
        expect(summarize(candidates,),).toEqual(await referenceSummaries({
          repository: fixture.repository,
          commits: [tip,],
          targetBase: 'manual-push:origin:refs/heads/main',
        },),);
      },
    },),
    it({
      name: 'prior destination of one update excludes history for another update to the same remote',
      fn: async function testSiblingUpdateExclusion() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(SHORT_HISTORY_COMMITS,), },);
        await fastImport({
          repository: fixture.repository,
          stream: branchCommits({
            ref: 'refs/heads/feature',
            start: 'refs/heads/main~2',
            firstMark: 1,
            paths: ['feature.txt',],
          },),
        },);
        /**
         Local main and feature tips plus main's prior destination.
         */
        const [mainTip, mainPrior, featureTip,] = await Promise.all([
          git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },),
          git({ cwd: fixture.repository, args: ['rev-parse', 'main~2',], },),
          git({ cwd: fixture.repository, args: ['rev-parse', 'feature',], },),
        ],);
        /**
         Candidates for two updates in one push.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [
            pushUpdate({ localOid: mainTip, remoteRef: 'refs/heads/main', remoteOid: mainPrior, },),
            pushUpdate({ localOid: featureTip, remoteRef: 'refs/heads/feature', },),
          ],
        },);
        expect(summarize(candidates,),).toEqual([
          ...await referenceSummaries({
            repository: fixture.repository,
            commits: await rangeCommits({ repository: fixture.repository, tip: mainTip, exclusions: [mainPrior,], },),
            targetBase: 'manual-push:origin:refs/heads/main',
          },),
          ...await referenceSummaries({
            repository: fixture.repository,
            commits: [featureTip,],
            targetBase: 'manual-push:origin:refs/heads/feature',
          },),
        ],);
      },
    },),

    //endregion Published-history exclusion

    //region Exact range semantics

    it({
      name: 'pushed range scans every new commit delta exactly across merges, roots, renames, deletions, and gitlinks',
      fn: async function testMixedRangeParity() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: MIXED_HISTORY, },);
        /**
         Pushed tip and authoritative prior destination.
         */
        const [tip, base,] = await Promise.all([
          git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },),
          git({ cwd: fixture.repository, args: ['rev-parse', 'main~2^1~1',], },),
        ],);
        /**
         Candidates for mixed range.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: tip, remoteRef: 'refs/heads/main', remoteOid: base, },),],
        },);
        /**
         Independently computed expectation.
         */
        const expected = await referenceSummaries({
          repository: fixture.repository,
          commits: await rangeCommits({ repository: fixture.repository, tip, exclusions: [base,], },),
          targetBase: 'manual-push:origin:refs/heads/main',
        },);
        expect(summarize(candidates,),).toEqual(expected,);
        // Guard the fixture itself: every edge family is present in the expectation.
        expect(expected.map(function pathOf(summary,) { return summary.path; },),).toContain('other.txt',);
        expect(expected.map(function pathOf(summary,) { return summary.path; },),).toContain('tools/exec.sh',);
        expect(expected.some(function isGitlink(summary,) { return summary.mode === 'submodule'; },),).toBe(true,);
        expect(expected.some(function isExecutable(summary,) { return summary.mode === 'executable'; },),).toBe(true,);
        expect(expected.map(function pathOf(summary,) { return summary.path; },),).not.toContain('b.txt',);
        await Promise.all(candidates.map(function load(candidate,) { return candidate.bytes(); },),);
      },
    },),

    //endregion Exact range semantics

    //region Process bounds

    it({
      name: `bounded range over ${String(LONG_HISTORY_COMMITS,)} commits spawns one diff-tree`,
      timeout: 60_000,
      fn: async function testBoundedRangeSpawns() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(LONG_HISTORY_COMMITS,), },);
        /**
         Pushed tip and root destination.
         */
        const [tip, root,] = await Promise.all([
          git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },),
          git({ cwd: fixture.repository, args: ['rev-list', '--max-parents=0', 'main',], },),
        ],);
        using recorder = recordSpawns(fixture.repository,);
        /**
         Candidates for every commit above root.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: tip, remoteRef: 'refs/heads/main', remoteOid: root, },),],
        },);
        expect(candidates,).toHaveLength(LONG_HISTORY_COMMITS - 1,);
        expect(countSubcommand({ recorder, subcommand: 'diff-tree', },),).toBe(1,);
        expect(recorder.records.length,).toBeLessThanOrEqual(MAX_SCAN_SPAWNS,);
        expect(recorder.peak(),).toBeLessThanOrEqual(MAX_CONCURRENT_SPAWNS,);
      },
    },),
    it({
      name: `empty-remote push of ${String(LONG_HISTORY_COMMITS,)} commits scans the tip tree once`,
      timeout: 60_000,
      fn: async function testEmptyRemoteTreeScan() {
        await using fixture = await createRepository();
        await fastImport({ repository: fixture.repository, stream: linearHistory(LONG_HISTORY_COMMITS,), },);
        /**
         Pushed tip.
         */
        const tip = await git({ cwd: fixture.repository, args: ['rev-parse', 'main',], },);
        using recorder = recordSpawns(fixture.repository,);
        /**
         Candidates for first push to empty remote.
         */
        const candidates = await createManualPushCandidates({
          gitPath: REAL_GIT,
          cwd: fixture.repository,
          updates: [pushUpdate({ localOid: tip, remoteRef: 'refs/heads/main', },),],
        },);
        expect(candidates,).toHaveLength(LONG_HISTORY_FILES,);
        expect(candidates.every(function isTipTree(candidate,) {
          return (candidate.change === 'added')
            && candidate.targetId.startsWith(`manual-push:origin:refs/heads/main:${tip}:`,);
        },),).toBe(true,);
        expect(countSubcommand({ recorder, subcommand: 'ls-tree', },),).toBe(1,);
        expect(countSubcommand({ recorder, subcommand: 'diff-tree', },),).toBe(0,);
        expect(countSubcommand({ recorder, subcommand: 'rev-list', },),).toBe(0,);
        expect(recorder.records.length,).toBeLessThanOrEqual(MAX_SCAN_SPAWNS,);
        expect(recorder.peak(),).toBeLessThanOrEqual(MAX_CONCURRENT_SPAWNS,);
      },
    },),

    //endregion Process bounds
  ],
},);
