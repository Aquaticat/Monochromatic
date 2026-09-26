/**
 The text half of replay's subsumption check:
 which regular-file paths hold prepared bytes that already contain the landed change.

 A path is subsumed when the landed change applies in reverse to the prepared bytes
 with Git's full context (`commit-replay-reverse-apply.ts`),
 or when the prepared change of every landed region is the landed change
 extended by the prepared commit's own edit on one side (`commit-replay-containment.ts`),
 the adjacent-edit case strict reverse application rejects.

 Hunks come from `git diff-tree -p --text` over single-level trees whose entries are named by index,
 so no patch header carries a user path,
 and attributes never turn a text file into a binary diff.
 Binary detection is Git's content rule instead:
 a NUL byte in the first 8000 bytes of any of the three blobs.

 @module
 */
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import { containsLandedChange, } from './commit-replay-containment.ts';
import {
  decodeLatin1,
  type PatchHunk,
  parseIndexedPatch,
  splitKeepingNewlines,
} from './commit-replay-patch.ts';
import { reverseApplies, } from './commit-replay-reverse-apply.ts';
import {
  presentOid,
  type SharedPath,
  sidesOf,
} from './commit-replay-shared-paths.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';

/**
 Bytes Git inspects for a NUL when deciding that a blob is binary (`FIRST_FEW_BYTES` in `xdiff-interface.c`).
 */
const BINARY_PROBE_BYTES = 8_000;

/**
 Stand-in bytes for a blob the batch did not return, which counts as binary and so is never subsumed.
 */
const MISSING_BLOB = new Uint8Array([0,],);

/**
 Context lines of the strict reverse check, Git's default.
 */
const STRICT_CONTEXT = 3;

/**
 Builds a transaction Git error from a batch diagnostic.

 @param message - diagnostic

 @returns error
 */
function batchError(message: string,): Error {
  return new CommitTransactionGitError(message,);
}

/**
 Git's content-based binary detection.

 @param bytes - blob bytes

 @returns whether a NUL appears in the probed prefix
 */
function isBinary(bytes: Uint8Array,): boolean {
  return bytes.subarray(
    0,
    BINARY_PROBE_BYTES,
  )
    .includes(0,);
}

/**
 Writes a single-level tree of regular-file entries named by index.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param oids - blobs in index order

 @returns tree ID
 */
async function indexedTree({
  gitPath,
  shadowPath,
  oids,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  oids: readonly string[];
}>,): Promise<string> {
  return decodeLatin1((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'mktree',
      '-z',
    ],
    input: new TextEncoder().encode(oids.map(function record(
      oid,
      index,
    ): string {
      return `100644 blob ${oid}\t${String(index,)}\0`;
    },)
      .join('',),),
  },)).stdout,)
    .trim();
}

/**
 Hunks per index between two index-named trees.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param from - older tree

 @param to - newer tree

 @param context - context lines per hunk

 @returns hunks per entry name
 */
async function indexedHunks({
  gitPath,
  shadowPath,
  from,
  to,
  context,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  from: string;
  to: string;
  context: number;
}>,): Promise<ReadonlyMap<string, readonly PatchHunk[]>> {
  return parseIndexedPatch(decodeLatin1((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'diff-tree',
      '-p',
      '--text',
      `--unified=${String(context,)}`,
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      from,
      to,
    ],
  },)).stdout,),);
}

/**
 Decides the text candidates: whose prepared bytes already contain the landed change.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param cwd - owning worktree directory

 @param objectDirectory - shadow object store, whose alternates name the real store

 @param candidates - paths whose three entries are regular files

 @returns subsumed candidates

 @throws {@link CommitTransactionGitError} when a Git command fails

 @example
 ```ts
 await subsumedTextPaths({ gitPath: '/usr/bin/git', shadowPath, cwd: '/repo', objectDirectory, candidates });
 ```
 */
export async function subsumedTextPaths({
  gitPath,
  shadowPath,
  cwd,
  objectDirectory,
  candidates,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  cwd: string;
  objectDirectory: string;
  candidates: readonly SharedPath[];
}>,): Promise<readonly SharedPath[]> {
  if (candidates.length === 0)
    return [];
  /**
   Every blob of every candidate.
   */
  const blobs = await loadBlobBatch({
    gitPath,
    cwd,
    oids: candidates.flatMap(function oids(shared,): readonly string[] {
      return sidesOf(shared,)
        .map(function oidOf(entry,): string {
          return presentOid(entry,);
        },);
    },),
    createError: batchError,
    objectDirectory,
  },);
  /**
   Bytes of one entry as text.

   @param oid - blob

   @returns Latin-1 text
   */
  function textOf(oid: string,): string {
    return decodeLatin1(blobs.get(oid,) ?? new Uint8Array(),);
  }
  /**
   Candidates whose three blobs are text.
   */
  const text = candidates.filter(function allText(shared,): boolean {
    return sidesOf(shared,)
      .every(function textBlob(entry,): boolean {
        return !isBinary(blobs.get(presentOid(entry,),) ?? MISSING_BLOB,);
      },);
  },);
  if (text.length === 0)
    return [];
  /**
   Index-named trees of the base, landed, and prepared blobs.
   */
  const [baseTree = '', landedTree = '', preparedTree = '',] = await Promise.all(([
    'base',
    'landed',
    'prepared',
  ] as const).map(function treeOf(side,): Promise<string> {
    return indexedTree({
      gitPath,
      shadowPath,
      oids: text.map(function oidOf(shared,): string {
        return presentOid(shared[side],);
      },),
    },);
  },),);
  /**
   Landed hunks with full context, and landed and prepared hunks without context.
   */
  const [strict, landedZero, preparedZero,] = await Promise.all([
    indexedHunks({
      gitPath,
      shadowPath,
      from: baseTree,
      to: landedTree,
      context: STRICT_CONTEXT,
    },),
    indexedHunks({
      gitPath,
      shadowPath,
      from: baseTree,
      to: landedTree,
      context: 0,
    },),
    indexedHunks({
      gitPath,
      shadowPath,
      from: baseTree,
      to: preparedTree,
      context: 0,
    },),
  ],);
  return text.filter(function subsumed(
    shared,
    index,
  ): boolean {
    /**
     Entry name of this candidate.
     */
    const name = String(index,);
    return reverseApplies({
      hunks: strict.get(name,) ?? [],
      prepared: textOf(presentOid(shared.prepared,),),
    },) || containsLandedChange({
      landed: landedZero.get(name,) ?? [],
      prepared: preparedZero.get(name,) ?? [],
      base: splitKeepingNewlines(
        textOf(presentOid(shared.base,),),
      ),
    },);
  },);
}
