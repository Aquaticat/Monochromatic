/**
 * Manual-push candidate scale regression tests.
 *
 * @module
 */
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { ABSENT_GIT_VALUE, } from '../api/context-types.ts';
import { createManualPushCandidates, } from './manual-push-candidates.ts';

/**
 * Real Git executable used behind instrumented wrapper.
 */
const REAL_GIT = '/usr/bin/git';
/**
 * Executable mode for instrumented wrapper.
 */
const EXECUTABLE_MODE = 0o755;
/**
 * Number of files repeated across each historical tree.
 */
const FILE_COUNT = 32;
/**
 * Number of newly reachable commits in fixture.
 */
const COMMIT_COUNT = 4;

/**
 * Disposable repository and Git invocation log.
 */
type CandidateFixture = Readonly<{
  /**
   * Instrumented Git executable.
   */
  gitPath: string;
  /**
   * JSONL invocation log.
   */
  logPath: string;
  /**
   * Git repository root.
   */
  repository: string;
  /**
   * Removes complete fixture.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Runs real Git in fixture repository.
 *
 * @param repository - disposable repository root
 *
 * @param args - exact Git arguments
 */
async function runGit({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<void> {
  await nanoSpawn(
    REAL_GIT,
    args,
    { cwd: repository, },
  );
}

/**
 * Creates multi-commit repository and instrumented Git passthrough.
 *
 * @returns initialized scale fixture
 */
async function createCandidateFixture(): Promise<CandidateFixture> {
  /**
   * Disposable root and repository.
   */
  const repository = await mkdtemp(join(tmpdir(), 'cli-git-manual-candidates-',),);
  /**
   * Wrapper invocation log outside Git history.
   */
  const logPath = join(repository, 'git-invocations.jsonl',);
  /**
   * Instrumented executable outside Git history.
   */
  const gitPath = join(repository, 'instrumented-git.mjs',);
  await writeFile(
    gitPath,
    `#!${process.execPath}
import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(logPath,)}, JSON.stringify(args) + '\\n');
const input = args[0] === 'cat-file' && args[1] === '--batch' ? readFileSync(0) : undefined;
const result = spawnSync(${JSON.stringify(REAL_GIT,)}, args, {
  cwd: process.cwd(),
  env: process.env,
  input,
  maxBuffer: 134217728,
});
if (result.stdout !== undefined) process.stdout.write(result.stdout);
if (result.stderr !== undefined) process.stderr.write(result.stderr);
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 2;
`,
  );
  await chmod(
    gitPath,
    EXECUTABLE_MODE,
  );
  await runGit({
    repository,
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
  },);
  await runGit({ repository, args: ['config', 'user.email', 'fixture@example.invalid',], },);
  await runGit({ repository, args: ['config', 'user.name', 'Fixture',], },);
  await Promise.all(Array.from(
    { length: FILE_COUNT, },
    function writeFixtureFile(_unused, index,) {
      return writeFile(
        join(repository, `file-${String(index,)}.txt`,),
        `initial-${String(index,)}\n`,
      );
    },
  ),);
  await runGit({ repository, args: ['add', '--', '*.txt',], },);
  await runGit({ repository, args: ['commit', '--quiet', '-m', 'initial',], },);
  for (let revisionIndex = 1; revisionIndex < COMMIT_COUNT; revisionIndex += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each commit must descend from the preceding fixture commit.
    await writeFile(
      join(repository, 'file-0.txt',),
      `revision-${String(revisionIndex,)}\n`,
    );
    // oxlint-disable-next-line no-await-in-loop -- Staging must follow the corresponding sequential fixture write.
    await runGit({ repository, args: ['add', '--', 'file-0.txt',], },);
    // oxlint-disable-next-line no-await-in-loop -- Commit history is intentionally linear and cannot be built concurrently.
    await runGit({
      repository,
      args: ['commit', '--quiet', '-m', `revision ${String(revisionIndex,)}`,],
    },);
  }
  return {
    gitPath,
    logPath,
    repository,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        repository,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: 'manual-push candidate batching',
  children: [
    it({
      name: 'loads repeated commit trees through one Git batch process',
      fn: async function testBatchedBlobLoading() {
        await using fixture = await createCandidateFixture();
        /**
         * Final local commit pushed as new remote ref.
         */
        const localOid = (await nanoSpawn(
          REAL_GIT,
          ['rev-parse', 'HEAD',],
          { cwd: fixture.repository, },
        )).stdout;
        /**
         * Per-commit delta candidates across every newly reachable commit.
         */
        const candidates = await createManualPushCandidates({
          gitPath: fixture.gitPath,
          cwd: fixture.repository,
          updates: [{
            localOid,
            remoteOid: ABSENT_GIT_VALUE,
            remoteName: 'origin',
            remoteRef: 'refs/heads/main',
          },],
        },);
        // Root commit introduces every file; each later commit only rewrites file-0.
        expect(candidates,).toHaveLength(FILE_COUNT + (COMMIT_COUNT - 1),);
        /**
         * Every committed revision of the repeatedly rewritten file.
         */
        const rewrittenRevisions = candidates.filter(function isRewritten(candidate,) {
          return candidate.path === 'file-0.txt';
        },);
        expect(rewrittenRevisions,).toHaveLength(COMMIT_COUNT,);
        await Promise.all(candidates.map(function loadCandidate(candidate,) {
          return candidate.bytes();
        },),);
        /**
         * Exact argument arrays observed by instrumented Git executable.
         */
        const invocations = (await readFile(fixture.logPath, 'utf8',))
          .split('\n',)
          .filter(function nonEmpty(line,) {
            return line.length > 0;
          },)
          .map(function parseInvocation(line,): readonly string[] {
            return JSON.parse(line,) as readonly string[];
          },);
        /**
         * Blob-content process calls after batched implementation.
         */
        const batchCalls = invocations.filter(function isBatchCall(args,) {
          return (args[0] === 'cat-file') && (args[1] === '--batch');
        },);
        const individualBlobCalls = invocations.filter(function isIndividualBlobCall(args,) {
          return (args[0] === 'cat-file') && (args[1] === 'blob');
        },);
        expect(batchCalls,).toHaveLength(1,);
        expect(individualBlobCalls,).toHaveLength(0,);
      },
    },),
    it({
      name: 'scans only the pushed range delta above an existing remote baseline',
      fn: async function testRangeDelta() {
        await using fixture = await createCandidateFixture();
        /**
         * Final local commit advancing the existing remote ref.
         */
        const localOid = (await nanoSpawn(
          REAL_GIT,
          ['rev-parse', 'HEAD',],
          { cwd: fixture.repository, },
        )).stdout;
        /**
         * Authoritative destination one commit behind local head.
         */
        const remoteOid = (await nanoSpawn(
          REAL_GIT,
          ['rev-parse', 'HEAD~1',],
          { cwd: fixture.repository, },
        )).stdout;
        /**
         * Delta candidates for the single newly reachable commit.
         */
        const candidates = await createManualPushCandidates({
          gitPath: fixture.gitPath,
          cwd: fixture.repository,
          updates: [{
            localOid,
            remoteOid,
            remoteName: 'origin',
            remoteRef: 'refs/heads/main',
          },],
        },);
        expect(candidates.map(function summary(candidate,) {
          return {
            path: candidate.path,
            change: candidate.change,
          };
        },),).toEqual([{
          path: 'file-0.txt',
          change: 'modified',
        },],);
      },
    },),
  ],
},);
