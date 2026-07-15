/**
 * Landed-commit identity and exact tree facts.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { realpath, } from 'node:fs/promises';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';
import type {
  LazyPolicyGitFacts,
  PushUpdate,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  GitObjectId,
} from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import { parseRawDiffRecords, } from './raw-diff-records.ts';

/**
 * Candidate promise has not been initialized.
 */
const CANDIDATES_NOT_LOADED: unique symbol = Symbol('landed candidates not loaded',);
/**
 * Strict decoder for Git metadata and repository paths.
 */
const UTF8_DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Git command could not provide required landed state.
 */
export class PostCommitGitError extends Error {
  /**
   * Creates landed-state failure.
   *
   * @param message - safe command failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'PostCommitGitError';
  }
}

/**
 * Runs real Git and returns exact stdout bytes.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - exact Git arguments
 *
 * @returns exact stdout bytes
 *
 * @throws PostCommitGitError when Git exits nonzero
 */
async function runGitBytes({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<Uint8Array> {
  /**
   * Child process with exact binary stdout.
   */
  const child = spawn(
    gitPath,
    [...args,],
    {
    cwd,
    stdio: [
      'ignore',
      'pipe',
      'pipe',
    ],
  },
  );
  /**
   * Concurrent output consumers started before settlement.
   */
  const output = Promise.all([
    arrayBuffer(child.stdout,),
    text(child.stderr,),
  ],);
  await once(
    child,
    'close',
  );
  /**
   * Exact stdout bytes and decoded stderr.
   */
  const [stdout, stderr,] = await output;
  if (child.exitCode !== 0)
    throw new PostCommitGitError(`git ${args.join(' ',)} failed: ${stderr.trim()}`,);
  return new Uint8Array(stdout,);
}

/**
 * Creates landed-domain error for malformed or failed Git output.
 *
 * @param message - safe failure explanation
 *
 * @returns landed-state failure
 */
function landedGitError(message: string,): Error {
  return new PostCommitGitError(message,);
}

/**
 * Loads only paths the landed commit changed as immutable candidate files.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param landedOid - exact landed commit
 *
 * @returns landed-delta candidates without unchanged tree entries
 */
async function loadLandedCandidates({
  gitPath,
  cwd,
  landedOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  landedOid: GitObjectId;
}>,): Promise<readonly CandidateFile[]> {
  /**
   * Raw NUL-delimited landed change records against every parent.
   */
  const deltaBytes = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '-r',
      '-z',
      '-m',
      landedOid,
    ],
  },);
  /**
   * Retained content-bearing landed change records.
   */
  const records = parseRawDiffRecords({
    text: UTF8_DECODER.decode(deltaBytes,),
    createError: landedGitError,
  },);
  /**
   * One batched read for every content-bearing landed blob. Submodule records
   * publish their commit identity rather than tree content, so they request no
   * blob; every remaining candidate is materialized by post-commit policies,
   * so nothing is read that a lazy per-candidate spawn would have skipped.
   */
  const blobBytes = await loadBlobBatch({
    gitPath,
    cwd,
    oids: records.flatMap(function contentOid(record,): readonly GitObjectId[] {
      return record.mode === 'submodule'
        ? []
        : [record.oid,];
    },),
    createError: landedGitError,
  },);
  return records.map(function toCandidate(record,): CandidateFile {
    return {
      targetId: `post-commit:${record.oid}:${record.path}`,
      path: record.path,
      revision: record.oid,
      mode: record.mode,
      change: record.change,
      bytes: function loadCommittedBytes(): Promise<Uint8Array> {
        if (record.mode === 'submodule')
          return Promise.resolve(new TextEncoder().encode(record.oid,),);
        /**
         * Exact shared blob view loaded by the single batch subprocess.
         */
        const bytes = blobBytes.get(record.oid,);
        if (bytes === undefined)
          throw new PostCommitGitError(`Git blob batch omitted requested object ${record.oid}.`,);
        return Promise.resolve(bytes,);
      },
    };
  },);
}

/**
 * Resolves exact landed commit after real Git succeeds.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @returns exact landed commit OID
 *
 * @example
 * ```ts
 * await resolveLandedCommitOid({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function resolveLandedCommitOid({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<GitObjectId> {
  /**
   * Exact commit identity command output.
   */
  const oidBytes = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      'HEAD^{commit}',
    ],
  },);
  /**
   * Decoded exact landed commit object ID.
   */
  const oid = UTF8_DECODER.decode(oidBytes,)
    .trim();
  if (oid.length === 0)
    throw new PostCommitGitError('Real Git returned empty landed commit identity.',);
  return oid;
}

/**
 * Resolves canonical repository root after landed OID is known.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @returns canonical repository root
 *
 * @example
 * ```ts
 * await resolvePostCommitRepositoryRoot({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function resolvePostCommitRepositoryRoot({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<string> {
  /**
   * Repository-root command output.
   */
  const rootBytes = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--show-toplevel',
    ],
  },);
  /**
   * Decoded repository root from real Git.
   */
  const root = UTF8_DECODER.decode(rootBytes,)
    .trim();
  if (root.length === 0)
    throw new PostCommitGitError('Real Git returned empty repository root.',);
  return realpath(root,);
}

/**
 * Returns empty push updates for non-push lifecycle.
 *
 * @returns empty immutable update set
 */
function emptyPushUpdates(): Promise<readonly PushUpdate[]> {
  return Promise.resolve([],);
}

/**
 * Creates memoized landed-commit facts for post-commit policies.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param landedOid - exact landed commit
 *
 * @returns lazy immutable Git facts
 *
 * @example
 * ```ts
 * createPostCommitGitFacts({ gitPath: '/usr/bin/git', cwd: '/repo', landedOid: 'abc' });
 * ```
 */
export function createPostCommitGitFacts({
  gitPath,
  cwd,
  landedOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  landedOid: GitObjectId;
}>,): LazyPolicyGitFacts {
  /**
   * Memoized lazy candidate loader with domain-specific absence state.
   */
  const candidates = (function createCandidateLoader() {
    /**
     * Candidate loading state retained only inside loader closure.
     */
    let state: Promise<readonly CandidateFile[]> | typeof CANDIDATES_NOT_LOADED = CANDIDATES_NOT_LOADED;
    return function loadCandidates(): Promise<readonly CandidateFile[]> {
      if ((typeof state) === 'symbol') {
        if (state !== CANDIDATES_NOT_LOADED)
          throw new PostCommitGitError('Unknown landed candidate state.',);
        state = loadLandedCandidates({
          gitPath,
          cwd,
          landedOid,
        },);
      }
      return state;
    };
  })();
  return {
    candidates,
    headOid: function headOid() { return Promise.resolve(landedOid,); },
    landedCommitOid: function landedCommitOid() { return Promise.resolve(landedOid,); },
    pushUpdates: emptyPushUpdates,
  };
}
