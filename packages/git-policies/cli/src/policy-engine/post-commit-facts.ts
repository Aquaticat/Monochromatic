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
 * Parsed landed diff-tree record retained for candidate construction.
 */
type LandedChangeRecord = Readonly<{
  /**
   * Repository-relative committed path.
   */
  path: string;
  /**
   * Landed-side Git object ID.
   */
  oid: GitObjectId;
  /**
   * Policy candidate mode.
   */
  mode: CandidateFileMode;
  /**
   * Landed change classification against commit parents.
   */
  change: 'added' | 'modified';
}>;

/**
 * Parses one raw diff-tree metadata token into a retained change record.
 *
 * @param meta - colon-prefixed raw metadata token
 *
 * @param path - NUL-separated companion path token
 *
 * @returns retained record, or empty for deletions absent from landed tree
 *
 * @throws PostCommitGitError when record fields are malformed
 */
function parseLandedChangeRecord({
  meta,
  path,
}: Readonly<{
  meta: string;
  path: string;
}>,): readonly LandedChangeRecord[] {
  /**
   * Old mode, new mode, old OID, new OID, and status fields.
   */
  const parts = meta.slice(1,)
    .split(' ',);
  /**
   * Landed-side tree mode text.
   */
  const modeText = requiredPart({
    parts,
    index: 1,
  },);
  /**
   * Landed-side Git object ID.
   */
  const oid = requiredPart({
    parts,
    index: 3,
  },);
  /**
   * Single-letter change status against one parent.
   */
  const status = requiredPart({
    parts,
    index: 4,
  },);
  // Deleted paths do not exist in the landed tree and never become candidates.
  if (status === 'D')
    return [];
  if ((status !== 'A') && (status !== 'M')
    && (status !== 'T'))
    throw new PostCommitGitError(`Unsupported landed change status ${status} for ${path}`,);
  /**
   * Policy mode mapped from landed Git mode.
   */
  const mode = TREE_MODES[modeText];
  if (mode === undefined)
    throw new PostCommitGitError(`Unsupported landed tree mode: ${modeText}`,);
  return [{
    path,
    oid,
    mode,
    change: status === 'A' ? 'added' : 'modified',
  },];
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
   * Alternating metadata and path tokens, excluding terminal empty token.
   */
  const tokens = UTF8_DECODER.decode(deltaBytes,)
    .split('\0',)
    .filter(function isToken(token,) {
      return token.length > 0;
    },);
  /**
   * First retained record per path across every parent diff.
   */
  const recordsByPath = new Map<string, LandedChangeRecord>();
  // Tokens alternate strictly: one colon-prefixed metadata token, then its path.
  for (let cursor = 0; cursor < tokens.length; cursor += 2) {
    /**
     * Colon-prefixed raw metadata token.
     */
    const meta = tokens[cursor];
    /**
     * Companion repository-relative path token.
     */
    const path = tokens[cursor + 1];
    if ((meta === undefined) || (!meta.startsWith(':',))
      || (path === undefined))
      throw new PostCommitGitError('Landed diff-tree output is not metadata/path token pairs.',);
    for (const record of parseLandedChangeRecord({
      meta,
      path,
    },))
      if (!recordsByPath.has(record.path,))
        recordsByPath.set(
          record.path,
          record,
        );
  }
  return [...recordsByPath.values(),].map(function toCandidate(record,): CandidateFile {
    return {
      targetId: `post-commit:${record.oid}:${record.path}`,
      path: record.path,
      revision: record.oid,
      mode: record.mode,
      change: record.change,
      bytes: function loadCommittedBytes(): Promise<Uint8Array> {
        if (record.mode === 'submodule')
          return Promise.resolve(new TextEncoder().encode(record.oid,),);
        return runGitBytes({
          gitPath,
          cwd,
          args: [
            'cat-file',
            'blob',
            record.oid,
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
