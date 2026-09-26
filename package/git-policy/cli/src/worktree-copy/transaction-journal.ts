import type { InstallLog, } from './install-log.ts';
import {
  type PendingWorktreeCopyJournal,
  writeJournal,
} from './journal.ts';
import type {
  InstalledWorktreePath,
  WorktreeCopyJournal,
} from './model.ts';

/**
 Mutable durable transaction state hidden inside one synchronization call.

 The journal header changes only with the phase;
 intents and creations go to the append-only install log,
 and the in-memory sets mirror everything recorded so far,
 header lists from older journals included.

 @example
 ```ts
 const state: JournalState = { pending, log, intended: new Set(), createdPaths: new Set() };
 ```
 */
export type JournalState = {
  /**
   Latest journal path and header record.
   */
  pending: PendingWorktreeCopyJournal;
  /**
   Append handle for intents and creations.
   */
  log: InstallLog;
  /**
   Every selected path claimed before destination mutation.
   */
  intended: Set<string>;
  /**
   Every path whose creation this transaction proved.
   */
  createdPaths: Set<string>;
};

/**
 Persists installation phase before destination mutation.

 @param state - mutable latest journal state

 @mutates state - replaces latest pending record after durable phase write

 @example
 ```ts
 await beginInstalling(state);
 ```
 */
export async function beginInstalling(state: JournalState,): Promise<void> {
  if (state.pending.record.phase === 'installing')
    return;
  /**
   Installing record replacing staged phase.
   */
  const record: WorktreeCopyJournal = {
    ...state.pending
      .record,
    phase: 'installing',
  };
  await writeJournal({
    path: state.pending
      .path,
    record,
  },);
  state.pending = {
    path: state.pending
      .path,
    record,
  };
}

/**
 Durably claims one batch of selected destination paths before any of them is created.

 @param state - mutable latest journal state

 @param relativePaths - selected repository paths the batch may create

 @mutates state - adds the newly claimed paths after the durable append

 @example
 ```ts
 await recordIntents({ state, relativePaths: ['cache', 'cache/data'] });
 ```
 */
export async function recordIntents({
  state,
  relativePaths,
}: Readonly<{
  state: JournalState;
  relativePaths: readonly string[];
}>,): Promise<void> {
  /**
   Paths not claimed by an earlier batch or an interrupted owner.
   */
  const unclaimed = relativePaths.filter(function isUnclaimed(relativePath,): boolean {
    return !state.intended.has(relativePath,);
  },);
  await state.log.appendIntents(unclaimed,);
  unclaimed.forEach(function claim(relativePath,): void {
    state.intended.add(relativePath,);
  },);
}

/**
 Durably records one batch of proven post-creation identities.

 @param state - mutable latest journal state

 @param entries - paths created by the batch with their identities

 @mutates state - adds the recorded paths after the durable append

 @example
 ```ts
 await recordCreations({ state, entries: [{ device: '1', inode: '2', relativePath: 'cache', selected: true }] });
 ```
 */
export async function recordCreations({
  state,
  entries,
}: Readonly<{
  state: JournalState;
  entries: readonly InstalledWorktreePath[];
}>,): Promise<void> {
  /**
   Creations not recorded before.
   */
  const unrecorded = entries.filter(function isUnrecorded(entry,): boolean {
    return !state.createdPaths.has(entry.relativePath,);
  },);
  await state.log.appendCreations(unrecorded,);
  unrecorded.forEach(function remember(entry,): void {
    state.createdPaths.add(entry.relativePath,);
  },);
}

/**
 Reports whether this transaction claimed or created a destination path,
 so an interrupted installation may resume at it.

 @param state - journal state

 @param relativePath - repository path

 @returns whether the path belongs to this transaction's recorded work

 @example
 ```ts
 isTransactionPath({ state, relativePath: 'cache' });
 ```
 */
export function isTransactionPath({
  state,
  relativePath,
}: Readonly<{
  state: JournalState;
  relativePath: string;
}>,): boolean {
  return state.intended.has(relativePath,) || state.createdPaths.has(relativePath,);
}
