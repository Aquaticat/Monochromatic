/**
 Append-only record of one installation's selected-entry intents and proven creations.

 The journal header is rewritten only when the transaction changes phase;
 each installation batch appends one intent line before it mutates the destination
 and one creation line after,
 so the bytes written grow with the entry count rather than its square.
 The log lives in the transaction's private stage container and is removed with it.

 @module
 */
import { constants, } from 'node:fs';
import {
  lstat,
  open,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { WorktreeCopyError, } from './errors.ts';
import { assertSafeRepositoryPath, } from './ignored-paths.ts';
import {
  isInstalledEntryArray,
  isStringArray,
} from './journal-validation.ts';
import type { InstalledWorktreePath, } from './model.ts';
import { assertPrivateWorktreeCopyPath, } from './private-path.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Install-log filename inside the private stage container.
 */
const INSTALL_LOG_NAME = 'install-log.jsonl';

/**
 Private install-log file mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 Line terminator that marks one complete appended record.
 */
const LINE_END = '\n';

/**
 Selected-entry intents and proven creations recovered from one install log.

 @example
 ```ts
 const recorded: InstallLogRecords = { intendedEntries: ['cache'], createdEntries: [] };
 ```
 */
export type InstallLogRecords = Readonly<{
  /**
   Selected repository paths claimed before destination mutation, in claim order.
   */
  intendedEntries: readonly string[];
  /**
   Paths proven created, with post-creation identities, in creation order.
   */
  createdEntries: readonly InstalledWorktreePath[];
}>;

/**
 Open append handle for one installation's log.

 @example
 ```ts
 await using opened = await openInstallLog('/worktrees/.cli-git-worktree-copy-abc');
 await opened.log.appendIntents(['cache']);
 ```
 */
export type InstallLog = Readonly<{
  /**
   Durably appends selected paths about to be created.
   */
  appendIntents: (relativePaths: readonly string[]) => Promise<void>;
  /**
   Durably appends proven post-creation identities.
   */
  appendCreations: (entries: readonly InstalledWorktreePath[]) => Promise<void>;
}>;

/**
 Parses one complete install-log line into the records it adds.

 @param line - one newline-terminated line without its terminator

 @param path - install-log path for diagnostics

 @returns intents and creations carried by the line

 @throws {@link WorktreeCopyError} when the line is not a valid record

 @example
 ```ts
 parseLine({ line: '{"intended":["cache"]}', path });
 ```
 */
function parseLine({
  line,
  path,
}: Readonly<{
  line: string;
  path: string;
}>,): InstallLogRecords {
  /**
   Untrusted parsed record.
   */
  const value: unknown = (function parseJson(): unknown {
    try {
      return JSON.parse(line,);
    }
    catch (error: unknown) {
      throw new WorktreeCopyError(`cli-git: worktree-copy install log is corrupt: ${JSON.stringify(path,)}.`, error,);
    }
  })();
  if (((typeof value) === 'object') && (value !== null) && ('intended' in value) && isStringArray(value.intended,)) {
    value.intended.forEach(assertSafeRepositoryPath,);
    return { intendedEntries: [...value.intended,], createdEntries: [], };
  }
  if (((typeof value) === 'object') && (value !== null) && ('created' in value) && isInstalledEntryArray(value.created,)) {
    value.created.forEach(function safeCreated(entry,): void {
      assertSafeRepositoryPath(entry.relativePath,);
    },);
    return {
      intendedEntries: [],
      createdEntries: value.created.map(function detached(entry,): InstalledWorktreePath {
        return { ...entry, };
      },),
    };
  }
  throw new WorktreeCopyError(`cli-git: worktree-copy install log is corrupt: ${JSON.stringify(path,)}.`,);
}

/**
 Reads the complete records of an existing install log and the byte length they span.
 A trailing fragment without a line terminator is an append the owner never finished and is ignored.

 @param path - install-log path

 @returns recorded intents and creations plus the length of the complete-line prefix

 @example
 ```ts
 await readCompleteRecords('/worktrees/.cli-git-worktree-copy-abc/install-log.jsonl');
 ```
 */
async function readCompleteRecords(path: string,): Promise<Readonly<{ records: InstallLogRecords; completeLength: number; totalLength: number; }>> {
  await assertPrivateWorktreeCopyPath({
    path,
    role: 'journal file',
  },);
  /**
   Raw log bytes.
   */
  const content = await readFile(path,);
  /**
   Byte length of the prefix made of complete lines.
   */
  const completeLength = content.lastIndexOf(LINE_END,) + 1;
  /**
   Complete lines in append order.
   */
  const lines = content.subarray(0, completeLength,)
    .toString('utf8',)
    .split(LINE_END,)
    .filter(function nonempty(line,): boolean {
      return line !== '';
    },);
  /**
   Records carried by every complete line.
   */
  const parsed = lines.map(function parseEach(line,): InstallLogRecords {
    return parseLine({
      line,
      path,
    },);
  },);
  return {
    records: {
      intendedEntries: parsed.flatMap(function intents(record,): readonly string[] {
        return record.intendedEntries;
      },),
      createdEntries: parsed.flatMap(function creations(record,): readonly InstalledWorktreePath[] {
        return record.createdEntries;
      },),
    },
    completeLength,
    totalLength: content.length,
  };
}

/**
 Reports whether a path exists without following a final symbolic link.

 @param path - candidate path

 @returns whether the path exists

 @example
 ```ts
 await pathExists('/worktrees/.cli-git-worktree-copy-abc/install-log.jsonl');
 ```
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 Flushes directory metadata where the host supports directory handles.

 @param path - directory whose new entry must survive a crash

 @example
 ```ts
 await syncDirectory('/worktrees/.cli-git-worktree-copy-abc');
 ```
 */
async function syncDirectory(path: string,): Promise<void> {
  if (process.platform === 'win32')
    return;
  /**
   Read-only directory handle used for metadata fsync.
   */
  await using handle = await open(path, constants.O_RDONLY,);
  await handle.sync();
}

/**
 Opens one installation's append-only log, returning what an interrupted owner already recorded.
 An unfinished trailing append is truncated so new records start on a fresh line.

 @param stageContainer - validated private stage container of the transaction

 @returns recorded intents and creations plus the append handle

 @throws {@link WorktreeCopyError} when an existing log is unsafe or corrupt

 @example
 ```ts
 await using opened = await openInstallLog('/worktrees/.cli-git-worktree-copy-abc');
 ```
 */
export async function openInstallLog(
  stageContainer: string,
): Promise<AsyncDisposable & Readonly<{ log: InstallLog; recorded: InstallLogRecords; }>> {
  /**
   Tagged install-log logger.
   */
  const ol = tagged({ tag: openInstallLog.name, l, },);
  /**
   Install-log path.
   */
  const path = join(stageContainer, INSTALL_LOG_NAME,);
  /**
   Whether an interrupted owner left a log.
   */
  const existed = await pathExists(path,);
  /**
   Complete records already present, empty for a new transaction.
   */
  const existing = existed
    ? await readCompleteRecords(path,)
    : { records: { intendedEntries: [], createdEntries: [], }, completeLength: 0, totalLength: 0, };
  /**
   Exclusive-owner append handle.
   */
  const handle = await open(
    path,
    constants.O_CREAT | constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
    PRIVATE_FILE_MODE,
  );
  try {
    if (existing.completeLength < existing.totalLength) {
      ol.debug(`truncating ${String(existing.totalLength - existing.completeLength,)} bytes of an unfinished append`,);
      await handle.truncate(existing.completeLength,);
      await handle.sync();
    }
    if (!existed)
      await syncDirectory(stageContainer,);
  }
  catch (error: unknown) {
    await handle.close();
    throw new WorktreeCopyError(`cli-git: could not open worktree-copy install log ${JSON.stringify(path,)}.`, error,);
  }
  /**
   Appends one record line and waits until it is durable.

   @param record - one intent or creation record
   */
  async function appendRecord(record: Readonly<Record<string, unknown>>,): Promise<void> {
    try {
      await handle.write(`${JSON.stringify(record,)}${LINE_END}`,);
      await handle.sync();
    }
    catch (error: unknown) {
      throw new WorktreeCopyError(`cli-git: could not persist worktree-copy install log ${JSON.stringify(path,)}.`, error,);
    }
  }
  return {
    recorded: existing.records,
    log: {
      appendIntents: async function appendIntents(relativePaths,): Promise<void> {
        if (relativePaths.length === 0)
          return;
        await appendRecord({ intended: [...relativePaths,], },);
      },
      appendCreations: async function appendCreations(entries,): Promise<void> {
        if (entries.length === 0)
          return;
        await appendRecord({
          created: entries.map(function plainEntry(entry,) {
            return { ...entry, };
          },),
        },);
      },
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await handle.close();
    },
  };
}
