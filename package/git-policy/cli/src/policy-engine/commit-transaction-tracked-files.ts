/**
 Lazy current-state tracked files backed by one Git index.

 @module
 */
import {
  ABSENT_GIT_VALUE,
  type AbsentGitValue,
} from '../api/context-types.ts';
import type {
  CandidateFileMode,
  GitObjectId,
  TrackedFile,
} from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import {
  type HeadTreeEntry,
  loadHeadTreeEntries,
  loadIndexEntries,
} from './commit-transaction-candidate-batch.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { INDEX_MODES, } from './commit-transaction-modes.ts';

/**
 Exact submodule identity encoder.
 */
const ENCODER = new TextEncoder();

/**
 Key of the one lazily started blob batch in its cache.
 */
const BLOB_BATCH_KEY = 'blobs';

/**
 Prefix of target IDs that name tracked files rather than candidates.
 */
export const TRACKED_TARGET_PREFIX = 'tracked:';

/**
 Builds the opaque target ID a patch uses to add one tracked file to a commit.

 @param oid - current index object ID

 @param path - repository path

 @returns target ID binding the patch to exact current content

 @example
 ```ts
 trackedTargetId({ oid: 'abc', path: 'package.json' });
 // => 'tracked:abc:package.json'
 ```
 */
export function trackedTargetId({
  oid,
  path,
}: Readonly<{
  oid: GitObjectId;
  path: string;
}>,): string {
  return `${TRACKED_TARGET_PREFIX}${oid}:${path}`;
}

/**
 Creates transaction-domain error for failed or malformed Git output.

 @param message - safe failure explanation

 @returns private-state failure
 */
function trackedFileGitError(message: string,): Error {
  return new CommitTransactionGitError(message,);
}

/**
 Maps a Git mode to a policy mode.

 @param modeText - raw Git mode

 @param path - repository path named in errors

 @param source - state that reported the mode, named in errors

 @returns policy file mode

 @throws CommitTransactionGitError when no policy mode matches
 */
function policyMode({
  modeText,
  path,
  source,
}: Readonly<{
  modeText: string;
  path: string;
  source: string;
}>,): CandidateFileMode {
  /**
   Mapped mode.
   */
  const mode = INDEX_MODES[modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported ${source} mode ${modeText} for ${path}`,);
  return mode;
}

/**
 Reads object bytes, publishing a submodule's commit identity instead of blob content.

 @param oid - object ID

 @param mode - policy mode of the entry

 @param blobs - lazily loaded blob batch

 @returns exact bytes

 @throws CommitTransactionGitError when the batch omitted the object
 */
async function objectBytes({
  oid,
  mode,
  blobs,
}: Readonly<{
  oid: GitObjectId;
  mode: CandidateFileMode;
  blobs: () => Promise<ReadonlyMap<string, Uint8Array>>;
}>,): Promise<Uint8Array> {
  if (mode === 'submodule')
    return ENCODER.encode(oid,);
  /**
   Exact shared blob view.
   */
  const bytes = (await blobs()).get(oid,);
  if (bytes === undefined)
    throw new CommitTransactionGitError(`Git blob batch omitted requested object ${oid}.`,);
  return bytes;
}

/**
 Loads tracked files matching Git pathspecs from one index, with their `HEAD` counterparts.

 Bytes load lazily through one shared batch the first time any file's bytes are read,
 so listing thousands of paths costs two metadata reads.

 @param gitPath - resolved Git executable

 @param cwd - effective repository directory

 @param indexPath - index holding current candidate state

 @param pathspecs - Git pathspecs, glob magic allowed

 @param baseRevision - baseline tree-ish for `headRevision` and `headBytes`

 @param objectDirectory - object store holding the index's blobs, such as a transaction's shadow store

 @returns tracked files in index path order

 @throws CommitTransactionGitError when index or `HEAD` state cannot back a file

 @example
 ```ts
 await loadTrackedFiles({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', pathspecs: [':(glob)package/*\/*\/package.json'] });
 ```
 */
export async function loadTrackedFiles({
  gitPath,
  cwd,
  indexPath,
  pathspecs,
  baseRevision = 'HEAD',
  objectDirectory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  pathspecs: readonly string[];
  baseRevision?: string;
  objectDirectory?: string;
}>,): Promise<readonly TrackedFile[]> {
  if (pathspecs.length === 0)
    return [];
  /**
   Current index records keyed by matched path.
   */
  const indexEntries = await loadIndexEntries({
    gitPath,
    cwd,
    indexPath,
    paths: pathspecs,
  },);
  /**
   Matched paths in index order.
   */
  const paths = [...indexEntries.keys(),];
  /**
   `HEAD` records for matched paths.
   */
  const headEntries: ReadonlyMap<string, HeadTreeEntry> = await loadHeadTreeEntries({
    gitPath,
    cwd,
    paths,
    revision: baseRevision,
  },);
  /**
   One cached batch promise, started by the first byte read.
   */
  const batchCache = new Map<string, Promise<ReadonlyMap<string, Uint8Array>>>();
  /**
   Starts or reuses the blob batch covering every current and `HEAD` blob.

   @returns exact blob views keyed by object ID
   */
  function blobs(): Promise<ReadonlyMap<string, Uint8Array>> {
    /**
     Previously started batch.
     */
    const started = batchCache.get(BLOB_BATCH_KEY,);
    if (started !== undefined)
      return started;
    /**
     Batch over every content-bearing object.
     */
    const batch = loadBlobBatch({
      gitPath,
      cwd,
      oids: [
        ...indexEntries.values(),
        ...headEntries.values(),
      ].flatMap(function contentOid(entry,): readonly GitObjectId[] {
        return (INDEX_MODES[entry.modeText] === 'submodule') || (INDEX_MODES[entry.modeText] === undefined)
          ? []
          : [entry.oid,];
      },),
      createError: trackedFileGitError,
      ...(objectDirectory === undefined ? {} : { objectDirectory, }),
    },);
    batchCache.set(
      BLOB_BATCH_KEY,
      batch,
    );
    return batch;
  }
  return paths.map(function toTrackedFile(path,): TrackedFile {
    /**
     Current record, present because the path came from the index.
     */
    const indexEntry = indexEntries.get(path,);
    if ((indexEntry === undefined) || (indexEntry.stage !== '0'))
      throw new CommitTransactionGitError(`Tracked index entry is unavailable for ${path}`,);
    /**
     Current policy mode.
     */
    const mode = policyMode({
      modeText: indexEntry.modeText,
      path,
      source: 'index',
    },);
    /**
     Optional `HEAD` record.
     */
    const headEntry = headEntries.get(path,);
    return {
      targetId: trackedTargetId({
        oid: indexEntry.oid,
        path,
      },),
      path,
      revision: indexEntry.oid,
      mode,
      headRevision: headEntry === undefined ? ABSENT_GIT_VALUE : headEntry.oid,
      bytes: function loadTrackedBytes(): Promise<Uint8Array> {
        return objectBytes({
          oid: indexEntry.oid,
          mode,
          blobs,
        },);
      },
      headBytes: function loadTrackedHeadBytes(): Promise<Uint8Array | AbsentGitValue> {
        if (headEntry === undefined)
          return Promise.resolve(ABSENT_GIT_VALUE,);
        return objectBytes({
          oid: headEntry.oid,
          mode: policyMode({
            modeText: headEntry.modeText,
            path,
            source: 'HEAD tree',
          },),
          blobs,
        },);
      },
    };
  },);
}
