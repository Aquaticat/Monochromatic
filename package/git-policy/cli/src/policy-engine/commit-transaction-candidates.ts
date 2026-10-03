/**
 Lazy policy candidates backed by private Git index.
 
 @module
 */
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  CandidateFileMode,
  GitObjectId,
  TrackedFile,
} from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import {
  type HeadTreeEntry,
  type IndexEntry,
  loadHeadTreeEntries,
  loadIndexEntries,
} from './commit-transaction-candidate-batch.ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';
import { INDEX_MODES, } from './commit-transaction-modes.ts';
import { loadTrackedFiles, } from './commit-transaction-tracked-files.ts';

/**
 Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 Exact submodule identity encoder.
 */
const ENCODER = new TextEncoder();
/**
 Creates transaction-domain error for failed or malformed Git output.
 
 @param message - safe failure explanation
 
 @returns private-state failure
 */
function transactionGitError(message: string,): Error {
  return new CommitTransactionGitError(message,);
}

/**
 Returns absent landed commit before commit execution.
 
 @returns explicit absence sentinel
 */
function absentLandedCommit(): Promise<typeof ABSENT_GIT_VALUE> {
  return Promise.resolve(ABSENT_GIT_VALUE,);
}

/**
 Returns no push updates during commit checks.
 
 @returns empty push update list
 */
function emptyPushUpdates(): Promise<readonly never[]> {
  return Promise.resolve([],);
}

/**
 Returns exact empty bytes for deleted candidate.
 
 @returns empty content bytes
 */
function deletedBytes(): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(),);
}

/**
 HEAD tree does not contain requested candidate path.
 */
const HEAD_MODE_ABSENT: unique symbol = Symbol('requested HEAD tree entry was absent',);

/**
 Maps one HEAD tree mode, rejecting modes no candidate can carry.
 
 Resolved for every path present in HEAD, including paths the index also
 holds, so a directory standing where a file is staged is rejected exactly as
 a per-path HEAD read rejected it.
 
 @param headEntries - HEAD tree records for complete path set
 
 @param path - repository path
 
 @returns policy mode, or absence sentinel when HEAD lacks path
 
 @throws CommitTransactionGitError when HEAD mode maps to no candidate mode
 */
function headCandidateMode({
  headEntries,
  path,
}: Readonly<{
  headEntries: ReadonlyMap<string, HeadTreeEntry>;
  path: string;
}>,): CandidateFileMode | typeof HEAD_MODE_ABSENT {
  /**
   Optional baseline record.
   */
  const headEntry = headEntries.get(path,);
  if (headEntry === undefined)
    return HEAD_MODE_ABSENT;
  /**
   Policy mode mapped from Git mode.
   */
  const mode = INDEX_MODES[headEntry.modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported HEAD tree mode ${headEntry.modeText} for ${path}`,);
  return mode;
}

/**
 Builds one candidate from batched index, HEAD, and blob facts.
 
 @param path - repository path
 
 @param indexEntries - private index records for complete path set
 
 @param headEntries - HEAD tree records for complete path set
 
 @param blobBytes - exact blob views loaded by one batch subprocess
 
 @returns immutable candidate over batch-owned bytes
 
 @throws CommitTransactionGitError when index state cannot back one candidate
 */
function buildCandidate({
  path,
  indexEntries,
  headEntries,
  blobBytes,
}: Readonly<{
  path: string;
  indexEntries: ReadonlyMap<string, IndexEntry>;
  headEntries: ReadonlyMap<string, HeadTreeEntry>;
  blobBytes: ReadonlyMap<string, Uint8Array>;
}>,): CandidateFile {
  /**
   Validated baseline mode, or absence sentinel when HEAD lacks path.
   */
  const headMode = headCandidateMode({
    headEntries,
    path,
  },);
  /**
   Optional staged record.
   */
  const indexEntry = indexEntries.get(path,);
  if (indexEntry === undefined) {
    if ((typeof headMode) === 'symbol')
      throw new CommitTransactionGitError(`Deleted candidate lacks HEAD entry: ${path}`,);
    return {
      targetId: `pre-commit:absent:${path}`,
      path,
      revision: ABSENT_GIT_VALUE,
      mode: headMode,
      change: 'deleted',
      bytes: deletedBytes,
    };
  }
  if (indexEntry.stage !== '0')
    throw new CommitTransactionGitError(`Private index entry is unavailable for ${path}`,);
  /**
   Policy mode.
   */
  const mode = INDEX_MODES[indexEntry.modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported private index mode ${indexEntry.modeText} for ${path}`,);
  /**
   Exact staged identity.
   */
  const { oid, } = indexEntry;
  return {
    targetId: `pre-commit:${oid}:${path}`,
    path,
    revision: oid,
    mode,
    change: ((typeof headMode) === 'symbol') ? 'added' : 'modified',
    bytes: function loadIndexBytes(): Promise<Uint8Array> {
      if (mode === 'submodule')
        return Promise.resolve(ENCODER.encode(oid,),);
      /**
       Exact shared blob view loaded by the single batch subprocess.
       */
      const bytes = blobBytes.get(oid,);
      if (bytes === undefined)
        throw new CommitTransactionGitError(`Git blob batch omitted requested object ${oid}.`,);
      return Promise.resolve(bytes,);
    },
  };
}

/**
 Loads every candidate through batched index, HEAD, and blob reads.
 
 Replaces two spawns per path plus one `git show` per byte read with three
 invocation groups for the complete path set. Staged blobs are read by object
 ID rather than `:path`, which names the same stage-zero object.
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository directory
 
 @param indexPath - private index
 
 @param paths - candidate repository paths
 
 @param baseRevision - baseline commit or tree
 
 @param objectDirectory - object store holding the index's blobs, the real store when absent
 
 @returns candidates in requested path order
 
 @throws CommitTransactionGitError when private state cannot back candidates
 */
async function loadPrivateIndexCandidates({
  gitPath,
  cwd,
  indexPath,
  paths,
  baseRevision,
  objectDirectory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
  baseRevision: string;
  objectDirectory?: string;
}>,): Promise<readonly CandidateFile[]> {
  /**
   Independent staged and baseline reads for complete path set.
   */
  const [indexEntries, headEntries,] = await Promise.all([
    loadIndexEntries({
      gitPath,
      cwd,
      indexPath,
      paths,
    },),
    loadHeadTreeEntries({
      gitPath,
      cwd,
      paths,
      revision: baseRevision,
    },),
  ],);
  /**
   One batched read for every content-bearing staged blob. Submodules publish
   their commit identity and deleted paths publish no bytes, so neither
   requests a blob.
   */
  const blobBytes = await loadBlobBatch({
    gitPath,
    cwd,
    oids: paths.flatMap(function contentOid(path,): readonly GitObjectId[] {
      /**
       Staged record for one path.
       */
      const entry = indexEntries.get(path,);
      if (entry === undefined)
        return [];
      return INDEX_MODES[entry.modeText] === 'submodule'
        ? []
        : [entry.oid,];
    },),
    createError: transactionGitError,
    ...(objectDirectory === undefined ? {} : { objectDirectory, }),
  },);
  return paths.map(function toCandidate(path,): CandidateFile {
    return buildCandidate({
      path,
      indexEntries,
      headEntries,
      blobBytes,
    },);
  },);
}

/**
 Creates lazy facts backed by current private index bytes.
 
 Every call reads current state, and is never memoized: one facts object
 outlives the patches applied through it, and callers deliberately re-read it
 to observe them. `direct-fix-install.ts` writes back what the last call
 returns, so a cached first read would reinstall the unfixed bytes.
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository directory
 
 @param indexPath - private index
 
 @param paths - candidate paths
 
 @param baseRevision - baseline commit or tree the transaction recorded; live `HEAD` outside a transaction
 
 @param objectDirectory - object store holding the private index's blobs, such as the transaction's shadow store; the real store when absent
 
 @returns policy Git facts
 
 @example
 ```ts
 createPrivateIndexFacts({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', paths: ['a'] });
 ```
 */
export function createPrivateIndexFacts({
  gitPath,
  cwd,
  indexPath,
  paths,
  baseRevision = 'HEAD',
  objectDirectory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
  baseRevision?: string;
  objectDirectory?: string;
}>,): LazyPolicyGitFacts {
  return {
    candidates: function candidates(): Promise<readonly CandidateFile[]> {
      return loadPrivateIndexCandidates({
        gitPath,
        cwd,
        indexPath,
        paths,
        baseRevision,
        ...(objectDirectory === undefined ? {} : { objectDirectory, }),
      },);
    },
    trackedFiles: function trackedFiles({ pathspecs, },): Promise<readonly TrackedFile[]> {
      return loadTrackedFiles({
        gitPath,
        cwd,
        indexPath,
        pathspecs,
        baseRevision,
        ...(objectDirectory === undefined ? {} : { objectDirectory, }),
      },);
    },
    headOid: async function headOid(): Promise<GitObjectId> {
      return DECODER.decode((await runTransactionGit({
        gitPath,
        cwd,
        args: [
          'rev-parse',
          '--verify',
          `${baseRevision}^{commit}`,
        ],
      },)).stdout,)
        .trim();
    },
    landedCommitOid: absentLandedCommit,
    pushUpdates: emptyPushUpdates,
  };
}
