import {
  entryMatches,
  lstatOrAbsent,
} from './entry-compare.ts';
import { applyEntryModes, } from './entry-manifest.ts';
import { WorktreeCopyError, } from './errors.ts';
import { filesystemPath, } from './ignored-paths.ts';
import {
  captureInstalledPath,
  createSelectedEntry,
  ensureParents,
} from './install-entry.ts';
import { rollbackCreated, } from './install-rollback.ts';
import type {
  InstalledWorktreePath,
  StagedWorktreeSnapshot,
  WorktreeCopyEntry,
} from './model.ts';
import {
  isTransactionPath,
  type JournalState,
  type RecordedPaths,
  recordCreations,
  recordIntents,
} from './transaction-journal.ts';

/**
 Selected entries claimed by one durable intent append and settled by one creation append.
 Bounds both the append count and the work an interrupted owner can leave unrecorded.
 */
const INSTALL_BATCH_ENTRIES = 512;

/**
 Asserts every existing destination entry is identical, or is this transaction's own interrupted directory,
 before mutation.

 A directory this transaction claimed or created still has its private installation mode
 when its owner was interrupted,
 because modes are applied after every entry exists;
 accepting it lets recovery resume.

 @param snapshot - validated staged source state

 @param destinationRoot - newly registered worktree root

 @param recorded - claims and creations this transaction recorded

 @returns selected paths absent from the destination

 @throws {@link WorktreeCopyError} on first differing collision

 @example
 ```ts
 await preflightDestination({ snapshot, destinationRoot: '/wt', recorded: journalState });
 ```
 */
async function preflightDestination({
  snapshot,
  destinationRoot,
  recorded,
}: Readonly<{
  snapshot: StagedWorktreeSnapshot;
  destinationRoot: string;
  recorded: RecordedPaths;
}>,): Promise<ReadonlySet<string>> {
  /**
   Selected paths not present in the destination.
   */
  const absent = new Set<string>();
  for (const entry of snapshot.entries) {
    /**
     Destination path aligned with staged entry.
     */
    const destinationPath = filesystemPath({
      root: destinationRoot,
      repositoryPath: entry.relativePath,
    },);
    /* oxlint-disable no-await-in-loop -- fail-fast collision order must follow deterministic manifest */
    /**
     Current destination no-follow metadata or absence.
     */
    const stats = await lstatOrAbsent(destinationPath,);
    /* oxlint-enable no-await-in-loop */
    if ((typeof stats) === 'symbol') {
      absent.add(entry.relativePath,);
      continue;
    }
    if ((entry.kind === 'directory') && stats.isDirectory()
      && isTransactionPath({
        recorded,
        relativePath: entry.relativePath,
      },)) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- exact comparison is required before any destination mutation
    if (!(await entryMatches({
      expectedRoot: snapshot.stageRoot,
      actualRoot: destinationRoot,
      entry,
    },))) {
      throw new WorktreeCopyError(
        `cli-git: ignored-state copy would overwrite differing destination entry ${JSON.stringify(entry.relativePath,)} in ${JSON.stringify(destinationRoot,)}.`,
      );
    }
  }
  return absent;
}

/**
 Splits the manifest into installation batches in manifest order.

 @param entries - parent-first manifest

 @returns consecutive batches of at most {@link INSTALL_BATCH_ENTRIES} entries

 @example
 ```ts
 installBatches(snapshot.entries);
 ```
 */
function installBatches(entries: readonly WorktreeCopyEntry[],): readonly (readonly WorktreeCopyEntry[])[] {
  return Array.from(
    { length: Math.ceil(entries.length / INSTALL_BATCH_ENTRIES,), },
    function batchAt(
      _unused,
      index,
    ): readonly WorktreeCopyEntry[] {
      return entries.slice(
        index * INSTALL_BATCH_ENTRIES,
        (index + 1) * INSTALL_BATCH_ENTRIES,
      );
    },
  );
}

/**
 Installs one batch: claims its absent selected paths, creates them, then records their identities.

 @param snapshot - validated private source snapshot

 @param destinationRoot - newly registered worktree root

 @param batch - consecutive manifest entries

 @param absent - selected paths absent at preflight

 @param created - transaction-owned creation list shared with rollback

 @param journalState - mutable durable transaction state

 @mutates created - appends every path the batch creates

 @mutates journalState - records the batch's intents and creations

 @example
 ```ts
 await installBatch({ snapshot, destinationRoot: '/wt', batch, absent, created, journalState });
 ```
 */
async function installBatch({
  snapshot,
  destinationRoot,
  batch,
  absent,
  created,
  journalState,
}: Readonly<{
  snapshot: StagedWorktreeSnapshot;
  destinationRoot: string;
  batch: readonly WorktreeCopyEntry[];
  absent: ReadonlySet<string>;
  created: InstalledWorktreePath[];
  journalState: JournalState;
}>,): Promise<void> {
  await recordIntents({
    state: journalState,
    relativePaths: batch
      .map(function entryPath(entry,): string {
        return entry.relativePath;
      },)
      .filter(function isAbsent(relativePath,): boolean {
        return absent.has(relativePath,);
      },),
  },);
  /**
   Creation-list length before this batch.
   */
  const batchStart = created.length;
  for (const entry of batch) {
    // oxlint-disable-next-line no-await-in-loop -- manifest parent order and rollback ownership require sequential install
    await ensureParents({
      destinationRoot,
      entry,
      created,
    },);
    /**
     Current destination path after parent creation.
     */
    const destinationPath = filesystemPath({
      root: destinationRoot,
      repositoryPath: entry.relativePath,
    },);
    // oxlint-disable-next-line no-await-in-loop -- destination can change between preflight and exact exclusive creation
    if ((typeof await lstatOrAbsent(destinationPath,)) !== 'symbol')
      continue;
    // oxlint-disable-next-line no-await-in-loop -- deterministic parent-before-child installation
    await createSelectedEntry({
      snapshot,
      destinationRoot,
      entry,
    },);
    // oxlint-disable-next-line no-await-in-loop -- ownership identity must follow successful selected creation
    created.push(await captureInstalledPath({
      destinationPath,
      relativePath: entry.relativePath,
      selected: true,
    },),);
  }
  await recordCreations({
    state: journalState,
    entries: created.slice(batchStart,),
  },);
}

/**
 Installs validated ignored snapshot without overwriting destination state.

 @param snapshot - validated private source snapshot

 @param destinationRoot - newly registered worktree root

 @param journalState - mutable durable transaction state

 @param priorCreations - paths an interrupted owner already proved created

 @mutates journalState - records batch intents and proven identities through journal helpers

 @returns count of newly installed selected entries

 @throws {@link WorktreeCopyError} after ownership-checked rollback on failure

 @example
 ```ts
 await installSnapshot({ snapshot, destinationRoot: '/wt', journalState, priorCreations: [] });
 ```
 */
export async function installSnapshot({
  snapshot,
  destinationRoot,
  journalState,
  priorCreations,
}: Readonly<{
  snapshot: StagedWorktreeSnapshot;
  destinationRoot: string;
  journalState: JournalState;
  priorCreations: readonly InstalledWorktreePath[];
}>,): Promise<number> {
  /**
   Prior and new paths with durable or in-memory post-creation identities.
   */
  const created: InstalledWorktreePath[] = priorCreations.map(function priorCreation(entry,): InstalledWorktreePath {
    return { ...entry, };
  },);
  try {
    /**
     Selected paths absent before installation.
     */
    const absent = await preflightDestination({
      snapshot,
      destinationRoot,
      recorded: journalState,
    },);
    for (const batch of installBatches(snapshot.entries,)) {
      // oxlint-disable-next-line no-await-in-loop -- batches install in manifest order so parents precede children
      await installBatch({
        snapshot,
        destinationRoot,
        batch,
        absent,
        created,
        journalState,
      },);
    }
    await applyEntryModes({
      root: destinationRoot,
      entries: snapshot.entries,
    },);
    return created.filter(function selectedEntry(installed,): boolean {
      return installed.selected;
    },)
      .length;
  }
  catch (error: unknown) {
    /**
     Paths that rollback could not safely remove.
     */
    const retained = await rollbackCreated({
      snapshot,
      destinationRoot,
      created,
    },);
    /**
     Incomplete rollback suffix retaining exact paths.
     */
    const suffix = retained.length === 0
      ? ''
      : ` Rollback retained: ${retained.map(function quotedPath(path,): string {
          return JSON.stringify(path,);
        },)
        .join(', ',)}.`;
    throw new WorktreeCopyError(
      `cli-git: ignored-state installation failed for ${JSON.stringify(destinationRoot,)}.${suffix}`,
      error,
    );
  }
}
