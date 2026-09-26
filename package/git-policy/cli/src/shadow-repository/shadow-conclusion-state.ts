/**
 Merge, cherry-pick, and revert conclusion state: copied into the shadow at preparation,
 and native cleanup reproduced in the owning worktree's Git directory at landing.

 An entry is removed from the owning worktree only while it still holds the bytes or value copied at preparation;
 a changed entry was written by another command after invocation and is kept.

 @module
 */
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { RefStorageFormat, } from '../policy-engine/commit-transaction-capture.ts';
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';
import {
  isMissingPath,
  writePrivateFile,
} from '../trust/registry-io.ts';
import {
  CONCLUSION_STATE_FILES,
  REMOVED_CONCLUSION_FILES,
  SEQUENCER_DIRECTORY,
  STORE_HELD_PSEUDOREFS,
} from './shadow-conclusion-names.ts';
import { runShadowGit, } from './shadow-refs.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Private directory holding the preparation-time copies.
 */
export const CONCLUSION_COPY_DIRECTORY = 'conclusion';

/**
 Record of the store-held pseudoref values copied at preparation.
 */
const STORE_RECORD_FILENAME = 'store-held.json';

/**
 Private directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Reports whether a path exists without following a final link.

 @param path - candidate path

 @returns whether it exists
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Reads a file, or `undefined` when absent.

 @param path - file path

 @returns bytes or absence
 */
async function readOptional(path: string,): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await readFile(path,),);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return undefined;
    throw error;
  }
}

/**
 Compares two optional byte arrays.

 @param left - first bytes

 @param right - second bytes

 @returns whether both exist with equal bytes
 */
function sameBytes({
  left,
  right,
}: Readonly<{
  left: Uint8Array | undefined;
  right: Uint8Array | undefined;
}>,): boolean {
  return (left !== undefined) && (right !== undefined) && (Buffer.compare(left, right,) === 0);
}

/**
 Resolves a pseudoref in the owning worktree, or `undefined` when absent.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param name - pseudoref

 @returns object ID or absence
 */
async function resolvePseudoref({
  gitPath,
  cwd,
  name,
}: Readonly<{
  gitPath: string;
  cwd: string;
  name: string;
}>,): Promise<string | undefined> {
  /**
   Quiet resolution.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      '--quiet',
      name,
    ],
    allowFailure: true,
  },);
  return result.exitCode === 0 ? DECODER.decode(result.stdout,)
    .trim() : undefined;
}

/**
 Reports whether a file entry lives in the ref store of this backend.

 @param refFormat - ref storage backend

 @param name - conclusion entry

 @returns whether the entry is store-held
 */
function isStoreHeld({
  refFormat,
  name,
}: Readonly<{
  refFormat: RefStorageFormat;
  name: string;
}>,): boolean {
  return (refFormat === 'reftable') && STORE_HELD_PSEUDOREFS.has(name,);
}

/**
 Copies each present conclusion entry of the owning worktree into the shadow and the transaction.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param gitDir - owning worktree Git directory

 @param shadowPath - shadow repository

 @param transactionDirectory - transaction directory receiving the comparison copies

 @param refFormat - ref storage backend

 @example
 ```ts
 await copyConclusionState({ gitPath: '/usr/bin/git', cwd: '/repo', gitDir: '/repo/.git', shadowPath, transactionDirectory, refFormat: 'files' });
 ```
 */
export async function copyConclusionState({
  gitPath,
  cwd,
  gitDir,
  shadowPath,
  transactionDirectory,
  refFormat,
}: Readonly<{
  gitPath: string;
  cwd: string;
  gitDir: string;
  shadowPath: string;
  transactionDirectory: string;
  refFormat: RefStorageFormat;
}>,): Promise<void> {
  /**
   Private comparison copies.
   */
  const copies = join(
    transactionDirectory,
    CONCLUSION_COPY_DIRECTORY,
  );
  await mkdir(
    copies,
    { mode: PRIVATE_DIRECTORY_MODE, },
  );
  /**
   Store-held pseudoref values copied through `update-ref`.
   */
  const storeHeld: Record<string, string> = {};
  for (const name of CONCLUSION_STATE_FILES) {
    if (isStoreHeld({
      refFormat,
      name,
    },)) {
      // oxlint-disable-next-line no-await-in-loop -- Pseudoref copies are few and each takes the shadow ref store lock.
      const value = await resolvePseudoref({
        gitPath,
        cwd,
        name,
      },);
      if (value !== undefined) {
        storeHeld[name] = value;
        // oxlint-disable-next-line no-await-in-loop -- Pseudoref copies are few and each takes the shadow ref store lock.
        await runShadowGit({
          gitPath,
          shadowPath,
          args: [
            'update-ref',
            name,
            value,
          ],
        },);
      }
      continue;
    }
    /**
     Owning worktree bytes, when present.
     */
    // oxlint-disable-next-line no-await-in-loop -- Sequential copies keep the comparison copy and shadow copy of one entry identical.
    const bytes = await readOptional(join(
      gitDir,
      name,
    ),);
    if (bytes === undefined)
      continue;
    // oxlint-disable-next-line no-await-in-loop -- Sequential copies keep the comparison copy and shadow copy of one entry identical.
    await Promise.all([
      writeFile(
        join(
          shadowPath,
          name,
        ),
        bytes,
        { mode: 0o600, },
      ),
      writePrivateFile({
        path: join(
          copies,
          name,
        ),
        bytes,
      },),
    ],);
  }
  await writePrivateFile({
    path: join(
      copies,
      STORE_RECORD_FILENAME,
    ),
    bytes: new TextEncoder().encode(`${JSON.stringify(storeHeld,)}\n`,),
  },);
  /**
   Owning worktree sequencer state.
   */
  const sequencer = join(
    gitDir,
    SEQUENCER_DIRECTORY,
  );
  if (await pathExists(sequencer,))
    await Promise.all([
      cp(
        sequencer,
        join(
          shadowPath,
          SEQUENCER_DIRECTORY,
        ),
        { recursive: true, },
      ),
      cp(
        sequencer,
        join(
          copies,
          SEQUENCER_DIRECTORY,
        ),
        { recursive: true, },
      ),
    ],);
}

/**
 Lists regular files under a directory with their relative paths.

 @param root - directory

 @returns relative path to bytes; empty when absent
 */
async function readTree(root: string,): Promise<ReadonlyMap<string, Uint8Array>> {
  if (!(await pathExists(root,)))
    return new Map();
  /**
   Recursive listing.
   */
  const entries = await readdir(
    root,
    {
      recursive: true,
      withFileTypes: true,
    },
  );
  /**
   File entries only.
   */
  const files = entries.filter(function isFile(entry,): boolean {
    return entry.isFile();
  },);
  return new Map(await Promise.all(files.map(async function readEntry(entry,): Promise<readonly [string, Uint8Array]> {
    /**
     Absolute file path.
     */
    const path = join(
      entry.parentPath,
      entry.name,
    );
    return [
      path.slice(root.length,),
      new Uint8Array(await readFile(path,),),
    ];
  },),),);
}

/**
 Reports whether two directory trees hold the same files and bytes.

 @param left - first directory

 @param right - second directory

 @returns whether both trees are equal and nonempty
 */
async function sameTree({
  left,
  right,
}: Readonly<{
  left: string;
  right: string;
}>,): Promise<boolean> {
  /**
   Both trees.
   */
  const [leftFiles, rightFiles,] = await Promise.all([
    readTree(left,),
    readTree(right,),
  ],);
  return (leftFiles.size > 0)
    && (leftFiles.size === rightFiles.size)
    && [...leftFiles,].every(function sameEntry([path, bytes,],): boolean {
      return sameBytes({
        left: bytes,
        right: rightFiles.get(path,),
      },);
    },);
}

/**
 Reproduces native conclusion cleanup in the owning worktree's Git directory from the shadow's final state.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param gitDir - owning worktree Git directory

 @param shadowPath - shadow repository after native `git commit`

 @param transactionDirectory - transaction holding the preparation copies

 @param refFormat - ref storage backend

 @example
 ```ts
 await reproduceConclusionCleanup({ gitPath: '/usr/bin/git', cwd: '/repo', gitDir: '/repo/.git', shadowPath, transactionDirectory, refFormat: 'files' });
 ```
 */
export async function reproduceConclusionCleanup({
  gitPath,
  cwd,
  gitDir,
  shadowPath,
  transactionDirectory,
  refFormat,
}: Readonly<{
  gitPath: string;
  cwd: string;
  gitDir: string;
  shadowPath: string;
  transactionDirectory: string;
  refFormat: RefStorageFormat;
}>,): Promise<void> {
  /**
   Tagged cleanup logger.
   */
  const rl = tagged({
    tag: reproduceConclusionCleanup.name,
    l,
  },);
  /**
   Preparation-time copies.
   */
  const copies = join(
    transactionDirectory,
    CONCLUSION_COPY_DIRECTORY,
  );
  if (!(await pathExists(copies,))) {
    rl.debug(`no conclusion state was copied: ${transactionDirectory}`,);
    return;
  }
  /**
   Store-held values copied at preparation.
   */
  const storeHeld: Readonly<Record<string, unknown>> = JSON.parse(DECODER.decode(await readFile(join(
    copies,
    STORE_RECORD_FILENAME,
  ),),),);
  for (const name of REMOVED_CONCLUSION_FILES) {
    if (isStoreHeld({
      refFormat,
      name,
    },)) {
      /**
       Value copied at preparation.
       */
      const copied = storeHeld[name];
      if ((typeof copied) !== 'string')
        continue;
      // oxlint-disable-next-line no-await-in-loop -- Each removal is conditional on the owning worktree's current value.
      const [inShadow, inReal,] = await Promise.all([
        runShadowGit({
          gitPath,
          shadowPath,
          args: [
            'rev-parse',
            '--verify',
            '--quiet',
            name,
          ],
          allowFailure: true,
        },),
        resolvePseudoref({
          gitPath,
          cwd,
          name,
        },),
      ],);
      if ((inShadow.exitCode !== 0) && (inReal === copied))
        // oxlint-disable-next-line no-await-in-loop -- Each removal is conditional on the owning worktree's current value.
        await runTransactionGit({
          gitPath,
          cwd,
          args: [
            'update-ref',
            '-d',
            name,
            String(copied,),
          ],
        },);
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- Each removal is conditional on the owning worktree's current bytes.
    const [copy, shadow, real,] = await Promise.all([
      readOptional(join(
        copies,
        name,
      ),),
      readOptional(join(
        shadowPath,
        name,
      ),),
      readOptional(join(
        gitDir,
        name,
      ),),
    ],);
    if ((copy !== undefined) && (shadow === undefined) && sameBytes({
      left: copy,
      right: real,
    },)) {
      // oxlint-disable-next-line no-await-in-loop -- Each removal is conditional on the owning worktree's current bytes.
      await rm(
        join(
          gitDir,
          name,
        ),
        { force: true, },
      );
      rl.debug(`removed conclusion entry ${name} as native Git did`,);
    }
  }
  /**
   Shadow `MERGE_RR` after native `rerere`.
   */
  const shadowMergeRr = await readOptional(join(
    shadowPath,
    'MERGE_RR',
  ),);
  if (shadowMergeRr !== undefined) {
    /**
     Same-directory temporary name for an atomic replacement.
     */
    const temporary = join(
      gitDir,
      `MERGE_RR.cli-git-${String(process.pid,)}`,
    );
    await writeFile(
      temporary,
      shadowMergeRr,
    );
    await rename(
      temporary,
      join(
        gitDir,
        'MERGE_RR',
      ),
    );
  }
  /**
   Whether native Git removed the shadow sequencer after the last pick.
   */
  const sequencerRemoved = (await pathExists(join(
    copies,
    SEQUENCER_DIRECTORY,
  ),)) && (!(await pathExists(join(
    shadowPath,
    SEQUENCER_DIRECTORY,
  ),)));
  if (sequencerRemoved && (await sameTree({
    left: join(
      copies,
      SEQUENCER_DIRECTORY,
    ),
    right: join(
      gitDir,
      SEQUENCER_DIRECTORY,
    ),
  },))) {
    await rm(
      join(
        gitDir,
        SEQUENCER_DIRECTORY,
      ),
      {
        recursive: true,
        force: true,
      },
    );
    rl.debug('removed sequencer state as native Git did after the last pick',);
  }
}
