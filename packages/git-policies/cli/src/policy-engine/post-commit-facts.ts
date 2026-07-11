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
  CandidateFileMode,
  GitObjectId,
} from '../api/policy-types.ts';

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
 * Git tree modes mapped to policy modes.
 */
const TREE_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};

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
 * Returns required parsed metadata part.
 *
 * @param parts - split metadata fields
 *
 * @param index - required field index
 *
 * @returns present metadata field
 *
 * @throws PostCommitGitError when field is absent
 */
function requiredPart({
  parts,
  index,
}: Readonly<{
  parts: readonly string[];
  index: number;
}>,): string {
  /**
   * Metadata field at required position.
   */
  const value = parts[index];
  if (value === undefined)
    throw new PostCommitGitError('Landed tree entry metadata is incomplete.',);
  return value;
}

/**
 * Loads repository paths changed by landed commit against its parents.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param landedOid - exact landed commit
 *
 * @returns changed repository path set
 */
async function loadLandedChangedPaths({
  gitPath,
  cwd,
  landedOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  landedOid: GitObjectId;
}>,): Promise<ReadonlySet<string>> {
  /** NUL-delimited changed paths, including every root-commit path. */
  const changedBytes = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--name-only',
      '-r',
      '-z',
      '-m',
      landedOid,
    ],
  },);
  return new Set(UTF8_DECODER.decode(changedBytes,)
    .split('\0',)
    .filter(function isChangedPath(path,) {
      return path.length > 0;
    },),);
}

/**
 * Loads complete landed tree as immutable candidate files.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param landedOid - exact landed commit
 *
 * @returns complete committed tree candidates
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
  /** Recursive tree metadata and landed change paths loaded concurrently. */
  const [treeBytes, changedPaths,] = await Promise.all([
    runGitBytes({
      gitPath,
      cwd,
      args: [
        'ls-tree',
        '--full-tree',
        '-r',
        '-z',
        landedOid,
      ],
    },),
    loadLandedChangedPaths({ gitPath, cwd, landedOid, },),
  ],);
  /**
   * Decoded tree records, excluding terminal empty record.
   */
  const records = UTF8_DECODER.decode(treeBytes,)
    .split('\0',)
    .filter(function isRecord(record,) {
      return record.length > 0;
    },);
  return records.map(function toCandidate(record,): CandidateFile {
    /**
     * Separator between metadata and raw path.
     */
    const pathSeparator = record.indexOf('\t',);
    if (pathSeparator === (-1))
      throw new PostCommitGitError('Landed tree entry lacks path separator.',);
    /**
     * Mode, object type, and object ID fields.
     */
    const parts = record.slice(
      0,
      pathSeparator,
    )
      .split(' ',);
    /**
     * Git tree mode text.
     */
    const modeText = requiredPart({
      parts,
      index: 0,
    },);
    /**
     * Git tree object type.
     */
    const objectType = requiredPart({
      parts,
      index: 1,
    },);
    /**
     * Git tree object ID.
     */
    const objectOid = requiredPart({
      parts,
      index: 2,
    },);
    /**
     * Policy mode mapped from Git tree mode.
     */
    const mode = TREE_MODES[modeText];
    if (mode === undefined)
      throw new PostCommitGitError(`Unsupported landed tree mode: ${modeText}`,);
    if ((objectType !== 'blob') && (objectType !== 'commit'))
      throw new PostCommitGitError(`Unsupported landed tree object type: ${objectType}`,);
    /**
     * Exact repository-relative committed path.
     */
    const path = record.slice(pathSeparator + 1,);
    return {
      targetId: `post-commit:${objectOid}:${path}`,
      path,
      revision: objectOid,
      mode,
      change: changedPaths.has(path,)
        ? 'modified'
        : 'unchanged',
      bytes: function loadCommittedBytes(): Promise<Uint8Array> {
        if (mode === 'submodule')
          return Promise.resolve(new TextEncoder().encode(objectOid,),);
        return runGitBytes({
          gitPath,
          cwd,
          args: [
            'cat-file',
            'blob',
            objectOid,
          ],
        },);
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
