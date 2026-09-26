/**
 Native conclusion cleanup reproduced in the owning worktree's Git directory at landing.

 An entry is removed only while it still holds the bytes or value copied at preparation;
 a changed entry was written by another command after invocation and is kept.
 The shadow's `MERGE_RR` is copied back,
 `ORIG_HEAD` is kept,
 and `sequencer/` is removed only when native Git removed the shadow copy after the last pick.

 @module
 */
import {
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
  CONCLUSION_COPY_DIRECTORY,
  ENTRY_ABSENT,
  isStoreHeld,
  pathExists,
  readOptional,
  resolvePseudoref,
  sameBytes,
  sameTree,
  STORE_RECORD_FILENAME,
} from './shadow-conclusion-files.ts';
import {
  REMOVED_CONCLUSION_FILES,
  SEQUENCER_DIRECTORY,
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
  const storeHeld: unknown = JSON.parse(
    DECODER.decode(
      await readFile(join(
    copies,
    STORE_RECORD_FILENAME,
  ),),
    ),
  );
  for (const name of REMOVED_CONCLUSION_FILES) {
    if (isStoreHeld({
      refFormat,
      name,
    },)) {
      /**
       Value copied at preparation.
       */
      const copied: unknown = ((typeof storeHeld) === 'object') && (storeHeld !== null)
        ? Reflect.get(
          storeHeld,
          name,
        )
        : ENTRY_ABSENT;
      if ((typeof copied) !== 'string')
        continue;
      /**
       Whether the shadow still holds the pseudoref, and the owning worktree's current value.
       */
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
            copied,
          ],
        },);
      continue;
    }
    /**
     Preparation copy, shadow bytes after native Git, and current owning-worktree bytes.
     */
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
    if ((copy !== ENTRY_ABSENT) && (shadow === ENTRY_ABSENT)
      && sameBytes({
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
  if (shadowMergeRr !== ENTRY_ABSENT) {
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
