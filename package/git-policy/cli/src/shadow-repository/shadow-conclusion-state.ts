/**
 Merge, cherry-pick, and revert conclusion state: copied into the shadow at preparation,
 and native cleanup reproduced in the owning worktree's Git directory at landing.

 An entry is removed from the owning worktree only while it still holds the bytes or value copied at preparation;
 a changed entry was written by another command after invocation and is kept.

 @module
 */
import {
  cp,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import type { RefStorageFormat, } from '../policy-engine/commit-transaction-capture.ts';
import { writePrivateFile, } from '../trust/registry-io.ts';
import {
  CONCLUSION_COPY_DIRECTORY,
  ENTRY_ABSENT,
  isStoreHeld,
  pathExists,
  PRIVATE_DIRECTORY_MODE,
  readOptional,
  resolvePseudoref,
  STORE_RECORD_FILENAME,
} from './shadow-conclusion-files.ts';
import {
  CONCLUSION_STATE_FILES,
  SEQUENCER_DIRECTORY,
} from './shadow-conclusion-names.ts';
import { runShadowGit, } from './shadow-refs.ts';


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
      /**
       Owning worktree pseudoref value.
       */
      // oxlint-disable-next-line no-await-in-loop -- Pseudoref copies are few and each takes the shadow ref store lock.
      const value = await resolvePseudoref({
        gitPath,
        cwd,
        name,
      },);
      if (value !== ENTRY_ABSENT) {
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
    if (bytes === ENTRY_ABSENT)
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
