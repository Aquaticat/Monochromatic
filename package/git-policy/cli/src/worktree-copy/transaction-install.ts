/**
 Runs one journaled destination installation to an end:
 installed and cleaned up,
 or failed,
 rolled back,
 and cleaned up.

 A failed installation never leaves its journal pending,
 because recovery would replay the same failure before every later command.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { collectEntryManifest, } from './entry-manifest.ts';
import { WorktreeCopyError, } from './errors.ts';
import { openInstallLog, } from './install-log.ts';
import { installSnapshot, } from './install.ts';
import {
  type PendingWorktreeCopyJournal,
  removeWorktreeCopyJournal,
} from './journal.ts';
import type {
  InstalledWorktreePath,
  StagedWorktreeSnapshot,
} from './model.ts';
import {
  beginInstalling,
  type JournalState,
} from './transaction-journal.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 End of one journaled installation.

 @example
 ```ts
 const outcome: InstallationOutcome = { kind: 'installed', copiedEntries: 2 };
 ```
 */
export type InstallationOutcome =
  | Readonly<{
    /**
     Every selected entry exists in the destination.
     */
    kind: 'installed';
    /**
     Selected entries this transaction created.
     */
    copiedEntries: number;
  }>
  | Readonly<{
    /**
     Installation failed after rollback; the journal and private stage are gone.
     */
    kind: 'ended';
    /**
     Failure naming every destination path rollback retained.
     */
    failure: WorktreeCopyError;
  }>;

/**
 Reconstructs staged snapshot from validated durable journal.

 @param journal - pending durable worktree-copy transaction

 @param intendedEntries - every selected path the transaction claimed

 @returns staged payload and deterministic manifest

 @throws {@link WorktreeCopyError} when the stage no longer holds a claimed path

 @example
 ```ts
 await snapshotFromJournal({ journal: pending, intendedEntries: [] });
 ```
 */
export async function snapshotFromJournal({
  journal,
  intendedEntries,
}: Readonly<{
  journal: PendingWorktreeCopyJournal;
  intendedEntries: Iterable<string>;
}>,): Promise<StagedWorktreeSnapshot> {
  try {
    /**
     Deterministic entries currently retained in staged payload.
     */
    const entries = await collectEntryManifest({
      root: journal.record
        .stageRoot,
      selectedRoots: journal.record
        .selectedRoots,
      excludedRoots: [],
    },);
    /**
     Reconstructed selected paths represented by private stage.
     */
    const entryPaths = new Set(entries.map(function entryPath(entry,): string {
      return entry.relativePath;
    },),);
    if (![...intendedEntries,].every(function representedIntent(relativePath,): boolean {
      return entryPaths.has(relativePath,);
    },)) {
      throw new WorktreeCopyError(
        `cli-git: worktree-copy journal intent is absent from private stage ${JSON.stringify(journal.record
          .stageRoot,)}.`,
      );
    }
    return {
      entries,
      selectedRoots: journal.record
        .selectedRoots,
      sourceRoot: journal.record
        .sourceRoot,
      stageContainer: journal.record
        .stageContainer,
      stageRoot: journal.record
        .stageRoot,
    };
  }
  catch (error: unknown) {
    throw new WorktreeCopyError(
      `cli-git: could not recover staged ignored state at ${JSON.stringify(journal.record
        .stageRoot,)}.`,
      error,
    );
  }
}

/**
 Installs one staged snapshot under its journal, resuming whatever an interrupted owner recorded.
 The install-log handle is closed before the caller removes the stage that contains it.

 @param pending - durable transaction

 @param snapshot - validated staged payload, or a builder that receives recorded intents

 @returns latest journal and installation result or failure

 @throws {@link WorktreeCopyError} when the log is unsafe or the phase cannot be persisted

 @example
 ```ts
 await installRecorded({ pending, snapshot: async () => snapshot });
 ```
 */
async function installRecorded({
  pending,
  snapshot,
}: Readonly<{
  pending: PendingWorktreeCopyJournal;
  snapshot: (intendedEntries: ReadonlySet<string>) => Promise<StagedWorktreeSnapshot>;
}>,): Promise<Readonly<{
  latest: PendingWorktreeCopyJournal;
  result: InstallationOutcome
}>> {
  /**
   Install log with what an interrupted owner recorded.
   */
  await using opened = await openInstallLog(pending.record
    .stageContainer,);
  /**
   Journal state seeded from the header lists older journals carry and from the log.
   */
  const state: JournalState = {
    pending,
    log: opened.log,
    intended: new Set([
      ...pending.record
        .intendedEntries,
      ...opened.recorded
        .intendedEntries,
    ],),
    createdPaths: new Set([
      ...pending.record
        .createdEntries,
      ...opened.recorded
        .createdEntries,
    ].map(function createdPath(entry,): string {
      return entry.relativePath;
    },),),
  };
  /**
   Paths an interrupted owner proved created.
   */
  const priorCreations: readonly InstalledWorktreePath[] = [
    ...pending.record
      .createdEntries,
    ...opened.recorded
      .createdEntries,
  ];
  /**
   Staged payload matching every recorded intent.
   */
  const staged = await snapshot(state.intended,);
  await beginInstalling(state,);
  try {
    return {
      latest: state.pending,
      result: {
        kind: 'installed',
        copiedEntries: await installSnapshot({
          snapshot: staged,
          destinationRoot: pending.record
            .destinationRoot,
          journalState: state,
          priorCreations,
        },),
      },
    };
  }
  catch (error: unknown) {
    return {
      latest: state.pending,
      result: {
        kind: 'ended',
        failure: error instanceof WorktreeCopyError
          ? error
          : new WorktreeCopyError(
            'cli-git: ignored-state installation failed.',
            error,
          ),
      },
    };
  }
}

/**
 Completes one staged or interrupted destination installation and removes its journal and stage
 whether installation succeeded or failed after rollback.

 @param pending - durable transaction

 @param snapshot - builds the validated staged payload once recorded intents are known

 @returns installation outcome

 @throws {@link WorktreeCopyError} when journal state is unsafe, so it stays for inspection

 @example
 ```ts
 await completeJournal({ pending, snapshot: async () => staged });
 ```
 */
export async function completeJournal({
  pending,
  snapshot,
}: Readonly<{
  pending: PendingWorktreeCopyJournal;
  snapshot: (intendedEntries: ReadonlySet<string>) => Promise<StagedWorktreeSnapshot>;
}>,): Promise<InstallationOutcome> {
  /**
   Tagged completion logger.
   */
  const cl = tagged({
    tag: completeJournal.name,
    l,
  },);
  /**
   Installation result and latest journal.
   */
  const {
    latest,
    result,
  } = await installRecorded({
    pending,
    snapshot,
  },);
  if (result.kind === 'ended')
    cl.debug(`installation into ${JSON.stringify(pending.record
      .destinationRoot,)} failed; ending its transaction`,);
  await removeWorktreeCopyJournal(latest,);
  return result;
}
