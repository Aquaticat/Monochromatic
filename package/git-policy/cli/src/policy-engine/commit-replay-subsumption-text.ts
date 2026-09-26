/**
 The text half of replay's subsumption check:
 which regular-file paths hold prepared bytes that already contain the landed change.

 The landed hunks come from one `git diff-tree -p --text` over two single-level trees
 whose entries are named by index,
 so no patch header carries a user path,
 and attributes never turn a text file into a binary diff.
 Binary detection is Git's content rule instead:
 a NUL byte in the first 8000 bytes of any of the three blobs.

 @module
 */
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import { parseIndexedPatch, } from './commit-replay-patch.ts';
import { reverseApplies, } from './commit-replay-reverse-apply.ts';
import {
  presentOid,
  type SharedPath,
  sidesOf,
} from './commit-replay-shared-paths.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';

/**
 Byte-preserving decoder for Git output that carries file bytes.
 */
const LATIN1 = new TextDecoder('latin1',);

/**
 Bytes Git inspects for a NUL when deciding that a blob is binary (`FIRST_FEW_BYTES` in `xdiff-interface.c`).
 */
const BINARY_PROBE_BYTES = 8_000;

/**
 Stand-in bytes for a blob the batch did not return, which counts as binary and so is never subsumed.
 */
const MISSING_BLOB = new Uint8Array([0,],);

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
  return LATIN1.decode((await runShadowGit({
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
 Decides the text candidates: whose landed change applies in reverse to the prepared bytes.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param cwd - owning worktree directory

 @param objectDirectory - shadow object store, whose alternates name the real store

 @param candidates - paths whose three entries are regular files

 @returns candidates whose prepared bytes contain the landed change

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
    oids: candidates.flatMap(function sides(shared,): readonly string[] {
      return [
        presentOid(shared.base,),
        presentOid(shared.landed,),
        presentOid(shared.prepared,),
      ];
    },),
    createError: batchError,
    objectDirectory,
  },);
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
   Index-named trees of the base and landed blobs.
   */
  const [baseTree, landedTree,] = await Promise.all([
    indexedTree({
      gitPath,
      shadowPath,
      oids: text.map(function baseOid(shared,): string {
        return presentOid(shared.base,);
      },),
    },),
    indexedTree({
      gitPath,
      shadowPath,
      oids: text.map(function landedOid(shared,): string {
        return presentOid(shared.landed,);
      },),
    },),
  ],);
  /**
   Landed hunks per index.
   */
  const hunks = parseIndexedPatch(LATIN1.decode((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'diff-tree',
      '-p',
      '--text',
      '--unified=3',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      baseTree,
      landedTree,
    ],
  },)).stdout,),);
  return text.filter(function contained(
    shared,
    index,
  ): boolean {
    return reverseApplies({
      hunks: hunks.get(String(index,),) ?? [],
      prepared: LATIN1.decode(blobs.get(presentOid(shared.prepared,),) ?? new Uint8Array(),),
    },);
  },);
}
