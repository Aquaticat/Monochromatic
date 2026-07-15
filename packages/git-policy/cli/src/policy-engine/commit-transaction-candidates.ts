/**
 * Lazy policy candidates backed by private Git index.
 *
 * @module
 */
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  CandidateFileMode,
  GitObjectId,
} from '../api/policy-types.ts';
import { mapBounded, } from './map-bounded.ts';
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
 * Exact submodule identity encoder.
 */
const ENCODER = new TextEncoder();
/**
 * Maximum simultaneous process-backed private candidate loads.
 */
const CANDIDATE_LOAD_CONCURRENCY = 64;
/**
 * Git index mode mapping.
 */
const INDEX_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};
/**
 * HEAD tree does not contain requested candidate path.
 */
const HEAD_ENTRY_ABSENT: unique symbol = Symbol('requested HEAD tree entry was absent',);
/**
 * Parsed HEAD tree entry.
 */
type HeadEntry = Readonly<{
  /**
   * Git object ID.
   */
  oid: GitObjectId;
  /**
   * Policy candidate mode.
   */
  mode: CandidateFileMode;
}>;

/**
 * Returns absent landed commit before commit execution.
 *
 * @returns explicit absence sentinel
 */
function absentLandedCommit(): Promise<typeof ABSENT_GIT_VALUE> {
  return Promise.resolve(ABSENT_GIT_VALUE,);
}

/**
 * Returns no push updates during commit checks.
 *
 * @returns empty push update list
 */
function emptyPushUpdates(): Promise<readonly never[]> {
  return Promise.resolve([],);
}

/**
 * Returns exact empty bytes for deleted candidate.
 *
 * @returns empty content bytes
 */
function deletedBytes(): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(),);
}

/**
 * Loads optional HEAD entry for classification and deletion facts.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param path - repository path
 *
 * @returns parsed entry or absence sentinel
 */
async function loadHeadEntry({
  gitPath,
  cwd,
  path,
}: Readonly<{
  gitPath: string;
  cwd: string;
  path: string;
}>,): Promise<HeadEntry | typeof HEAD_ENTRY_ABSENT> {
  /**
   * Optional exact HEAD tree record.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'ls-tree',
      '-z',
      'HEAD',
      '--',
      path,
    ],
    allowFailure: true,
  },);
  /**
   * Decoded sole tree record.
   */
  const record = DECODER.decode(output.stdout,)
    .replaceAll(
      '\0',
      '',
    )
    .trim();
  if ((output.exitCode !== 0) || (record.length === 0))
    return HEAD_ENTRY_ABSENT;
  /**
   * Metadata/path boundary.
   */
  const tab = record.indexOf('\t',);
  /**
   * Mode, type, and object identity.
   */
  const [modeText, _type, oid,] = (tab === (-1) ? record : record.slice(
    0,
    tab,
  )).split(' ',);
  if ((modeText === undefined) || (oid === undefined))
    throw new CommitTransactionGitError(`HEAD tree metadata is incomplete for ${path}`,);
  /**
   * Policy mode mapped from Git mode.
   */
  const mode = INDEX_MODES[modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported HEAD tree mode ${modeText} for ${path}`,);
  return {
    oid,
    mode,
  };
}

/**
 * Loads one index candidate.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @param path - repository path
 *
 * @returns immutable lazy candidate
 */
async function loadIndexCandidate({
  gitPath,
  cwd,
  indexPath,
  path,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  path: string;
}>,): Promise<CandidateFile> {
  /**
   * Stage-zero index metadata.
   */
  const metadata = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--stage',
      '--',
      path,
    ],
  },)).stdout,)
    .trim();
  /**
   * Optional baseline entry.
   */
  const headEntry = await loadHeadEntry({
    gitPath,
    cwd,
    path,
  },);
  if (metadata.length === 0) {
    if ((typeof headEntry) === 'symbol')
      throw new CommitTransactionGitError(`Deleted candidate lacks HEAD entry: ${path}`,);
    return {
      targetId: `pre-commit:absent:${path}`,
      path,
      revision: ABSENT_GIT_VALUE,
      mode: headEntry.mode,
      change: 'deleted',
      bytes: deletedBytes,
    };
  }
  /**
   * Metadata/path separator.
   */
  const tab = metadata.indexOf('\t',);
  /**
   * Metadata fields before path.
   */
  const parts = (tab === (-1) ? metadata : metadata.slice(
    0,
    tab,
  )).split(' ',);
  /**
   * Git mode and object ID.
   */
  const [modeText, oid, stage,] = parts;
  if ((modeText === undefined) || (oid === undefined)
    || (stage !== '0'))
    throw new CommitTransactionGitError(`Private index entry is unavailable for ${path}`,);
  /**
   * Policy mode.
   */
  const mode = INDEX_MODES[modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported private index mode ${modeText} for ${path}`,);
  return {
    targetId: `pre-commit:${oid}:${path}`,
    path,
    revision: oid,
    mode,
    change: (typeof headEntry) === 'symbol' ? 'added' : 'modified',
    bytes: async function loadIndexBytes(): Promise<Uint8Array> {
      if (mode === 'submodule')
        return ENCODER.encode(oid,);
      return (await runTransactionGit({
        gitPath,
        cwd,
        indexPath,
        args: [
          'show',
          `:${path}`,
        ],
      },)).stdout;
    },
  };
}

/**
 * Creates lazy facts backed by current private index bytes.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @param paths - candidate paths
 *
 * @returns policy Git facts
 *
 * @example
 * ```ts
 * createPrivateIndexFacts({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', paths: ['a'] });
 * ```
 */
export function createPrivateIndexFacts({
  gitPath,
  cwd,
  indexPath,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
}>,): LazyPolicyGitFacts {
  return {
    candidates: function candidates(): Promise<readonly CandidateFile[]> {
      return mapBounded({
        values: paths,
        concurrency: CANDIDATE_LOAD_CONCURRENCY,
        map: function loadPath({ value: path, }) {
          return loadIndexCandidate({
            gitPath,
            cwd,
            indexPath,
            path,
          },);
        },
      },);
    },
    headOid: async function headOid(): Promise<GitObjectId> {
      return DECODER.decode((await runTransactionGit({
        gitPath,
        cwd,
        args: [
          'rev-parse',
          '--verify',
          'HEAD^{commit}',
        ],
      },)).stdout,)
        .trim();
    },
    landedCommitOid: absentLandedCommit,
    pushUpdates: emptyPushUpdates,
  };
}

/**
 * Returns unmerged paths from private index.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param indexPath - private index
 *
 * @returns unique unmerged repository paths
 *
 * @example
 * ```ts
 * await listUnmergedIndexPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index' });
 * ```
 */
export async function listUnmergedIndexPaths({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<readonly string[]> {
  /**
   * NUL-delimited unmerged stage records.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--unmerged',
      '-z',
    ],
  },);
  /**
   * Repository paths deduplicated across conflict stages.
   */
  const paths = DECODER.decode(output.stdout,)
    .split('\0',)
    .flatMap(function recordPath(record,) {
      /**
       * Metadata/path separator.
       */
      const tab = record.indexOf('\t',);
      return tab === (-1) ? [] : [record.slice(tab + 1,),];
    },);
  return [...new Set(paths,),];
}

/**
 * Returns concrete paths from private index through Git pathspec semantics.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository cwd
 *
 * @param indexPath - private index path
 *
 * @param pathspecs - Git pathspec scope
 *
 * @returns ordered concrete repository paths
 *
 * @example
 * ```ts
 * await listPrivateIndexPaths({ gitPath, cwd, indexPath, pathspecs: [':/'] });
 * ```
 */
export async function listPrivateIndexPaths({
  gitPath,
  cwd,
  indexPath,
  pathspecs,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  pathspecs: readonly string[];
}>,): Promise<readonly string[]> {
  /**
   * NUL-delimited private-index path output.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '-z',
      '--',
      ...pathspecs,
    ],
  },);
  return DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
    return path.length > 0;
  },);
}

/**
 * Returns staged paths from private index relative to HEAD.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param indexPath - private index
 *
 * @returns repository paths
 *
 * @example
 * ```ts
 * await listChangedIndexPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index' });
 * ```
 */
export async function listChangedIndexPaths({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<readonly string[]> {
  /**
   * Optional existing parent commit.
   */
  const head = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      'HEAD^{commit}',
    ],
    allowFailure: true,
  },);
  /**
   * NUL-delimited changed or unborn-index paths.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: head.exitCode === 0
      ? [
        'diff',
        '--cached',
        '--name-only',
        '-z',
        'HEAD',
      ]
      : [
        'ls-files',
        '--cached',
        '-z',
      ],
  },);
  return DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
    return path.length > 0;
  },);
}
