/**
 * Batched private-index and HEAD tree reads for commit-transaction candidates.
 *
 * @module
 */
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';

/**
 * Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Paths sent to one Git invocation. Candidate paths expand from pathspecs, so
 * they can outnumber the arguments this process itself received; chunking keeps
 * every invocation far below `ARG_MAX` while spawning once per chunk rather
 * than once per path.
 */
const PATHSPEC_CHUNK_SIZE = 2_048;

/**
 * Stage record parsed from private index.
 */
export type IndexEntry = Readonly<{
  /**
   * Raw Git mode text.
   */
  modeText: string;
  /**
   * Git object ID.
   */
  oid: string;
  /**
   * Stage number text, where `0` means merged.
   */
  stage: string;
}>;

/**
 * Tree record parsed from HEAD.
 */
export type HeadTreeEntry = Readonly<{
  /**
   * Raw Git mode text, including `040000` for directory transitions.
   */
  modeText: string;
  /**
   * Git object ID.
   */
  oid: string;
}>;

/**
 * Splits paths into invocation-sized chunks.
 *
 * @param paths - candidate repository paths
 *
 * @returns chunks preserving input order
 *
 * @example
 * ```ts
 * chunkPaths(['a', 'b']);
 * // => [['a', 'b']]
 * ```
 */
function chunkPaths(paths: readonly string[],): readonly (readonly string[])[] {
  return Array.from(
    { length: Math.ceil(paths.length / PATHSPEC_CHUNK_SIZE,), },
    function chunkAt(
      _unused,
      index,
    ): readonly string[] {
      return paths.slice(
        index * PATHSPEC_CHUNK_SIZE,
        (index + 1) * PATHSPEC_CHUNK_SIZE,
      );
    },
  );
}

/**
 * Splits NUL-delimited Git output into metadata and path pairs.
 *
 * @param stdout - exact NUL-delimited output bytes
 *
 * @returns metadata text and repository path per record
 */
function splitRecords(stdout: Uint8Array,): readonly (readonly [
  string,
  string
])[] {
  return DECODER.decode(stdout,)
    .split('\0',)
    .flatMap(function toRecord(record,): readonly (readonly [
      string,
      string
    ])[] {
      /**
       * Metadata and path boundary.
       */
      const tab = record.indexOf('\t',);
      return tab === (-1)
        ? []
        : [[
          record.slice(
            0,
            tab,
          ),
          record.slice(tab + 1,),
        ],];
    },);
}

/**
 * Loads stage-zero-first index entries for every requested path.
 *
 * Replaces one `ls-files --stage` spawn per path. Absent paths are simply
 * missing from the result, which is how a deleted candidate is recognised.
 * Unmerged paths keep their lowest stage first, so a caller rejecting a
 * nonzero stage sees exactly what a per-path read reported.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @param paths - candidate repository paths
 *
 * @returns first stage record per present path
 *
 * @throws CommitTransactionGitError when index metadata is incomplete
 *
 * @example
 * ```ts
 * await loadIndexEntries({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', paths: ['a'] });
 * ```
 */
export async function loadIndexEntries({
  gitPath,
  cwd,
  indexPath,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
}>,): Promise<ReadonlyMap<string, IndexEntry>> {
  /**
   * Stage records for every chunk, read concurrently over disjoint paths.
   */
  const outputs = await Promise.all(chunkPaths(paths,)
    .map(function readChunk(chunk,) {
      return runTransactionGit({
        gitPath,
        cwd,
        indexPath,
        args: [
          'ls-files',
          '--stage',
          '-z',
          '--',
          ...chunk,
        ],
      },);
    },),);
  /**
   * First stage record per path across every chunk.
   */
  const entries = new Map<string, IndexEntry>();
  for (const output of outputs) {
    for (const [meta, path,] of splitRecords(output.stdout,)) {
      /**
       * Mode, object ID, and stage fields.
       */
      const [modeText, oid, stage,] = meta.split(' ',);
      if ((modeText === undefined) || (oid === undefined)
        || (stage === undefined))
        throw new CommitTransactionGitError(`Private index entry is unavailable for ${path}`,);
      // Git lists ascending stages per path, so the first record retained wins.
      if (!entries.has(path,))
        entries.set(
          path,
          {
            modeText,
            oid,
            stage,
          },
        );
    }
  }
  return entries;
}

/**
 * Loads HEAD tree entries for every requested path.
 *
 * Replaces one `ls-tree` spawn per path. An unborn HEAD makes Git exit nonzero
 * for the whole chunk, which yields no entries and classifies every candidate
 * as added, matching a per-path read against a repository without commits.
 * Directory transitions keep their `040000` mode so callers reject them exactly
 * as a per-path read did.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param paths - candidate repository paths
 *
 * @returns tree record per path present in HEAD
 *
 * @throws CommitTransactionGitError when HEAD tree metadata is incomplete
 *
 * @example
 * ```ts
 * await loadHeadTreeEntries({ gitPath: '/usr/bin/git', cwd: '/repo', paths: ['a'] });
 * ```
 */
export async function loadHeadTreeEntries({
  gitPath,
  cwd,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  paths: readonly string[];
}>,): Promise<ReadonlyMap<string, HeadTreeEntry>> {
  /**
   * Optional tree records for every chunk, read concurrently over disjoint paths.
   */
  const outputs = await Promise.all(chunkPaths(paths,)
    .map(function readChunk(chunk,) {
      return runTransactionGit({
        gitPath,
        cwd,
        args: [
          'ls-tree',
          '-z',
          'HEAD',
          '--',
          ...chunk,
        ],
        allowFailure: true,
      },);
    },),);
  /**
   * Tree record per path across every chunk.
   */
  const entries = new Map<string, HeadTreeEntry>();
  for (const output of outputs) {
    if (output.exitCode !== 0)
      continue;
    for (const [meta, path,] of splitRecords(output.stdout,)) {
      /**
       * Mode, object type, and object ID fields.
       */
      const [modeText, _type, oid,] = meta.split(' ',);
      if ((modeText === undefined) || (oid === undefined))
        throw new CommitTransactionGitError(`HEAD tree metadata is incomplete for ${path}`,);
      if (!entries.has(path,))
        entries.set(
          path,
          {
            modeText,
            oid,
          },
        );
    }
  }
  return entries;
}
