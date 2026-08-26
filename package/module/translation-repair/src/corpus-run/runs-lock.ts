import { randomUUID, } from 'node:crypto';
import {
  mkdir,
  open,
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { refusalText, } from '../refusal-text.ts';
import { readRunJson, } from '../run-json-read.ts';

//region Runs lock
// ONE pass at a time per runs directory.
//
// Nothing stopped two from sharing one. They would interleave on every durable
// thing the run owns, and each failure is silent in its own way:
//
//   `attempts.json` is read at startup and rewritten before each entry, so the
//   second pass writes counts derived from a map it read before the first pass
//   started. Attempts stop counting attempts, and attempts order the queue.
//
//   A slice cache is opened per entry, and opening one under a different
//   pipeline DELETES it. Two passes under different builds would take turns
//   destroying each other's finished slices, each recomputing what the other
//   just threw away, for as long as both ran.
//
//   Artifacts are written atomically, so neither is torn, but the later write
//   wins and the earlier entry's work is simply gone.
//
// The atomic rename in `writeFileAtomic` protects a READER from a half-written
// file. It says nothing about two writers, which is this.

/**
 * Name of the lock file inside a runs directory.
 */
const LOCK_FILE = 'pass.lock';

/**
 * What a lock file records about its holder.
 *
 * @example
 * ```ts
 * const holder: LockHolder = { pid: 1234, startedAt: '2026-08-15T00:00:00.000Z', };
 * ```
 */
type LockHolder = Readonly<{
  /**
   * Process holding it.
   */
  pid: number;

  /**
   * When it took the lock, for a message a human can act on.
   */
  startedAt: string;

  /**
   * Random per-acquisition token, so a release removes only the lock this
   * acquisition wrote and never a later holder's (`#243`). Empty on locks
   * written before the token existed, which therefore never read as ours.
   */
  token: string;
}>;

/**
 * What a lock file turned out to say.
 *
 * A named outcome rather than an absent holder, because "no readable holder"
 * is a state a refusal has to describe, and a message that cannot say whether
 * the lock named nobody or could not be read at all leaves an operator
 * guessing.
 *
 * @example
 * ```ts
 * const read: HolderRead = { kind: 'unreadable', };
 * ```
 */
type HolderRead =
  | Readonly<{
    /**
     * Lock file named a process.
     */
    kind: 'holder';

    /**
     * Who it named.
     */
    holder: LockHolder;
  }>
  | Readonly<{
    /**
     * Lock file said nothing this can act on.
     */
    kind: 'unreadable';
  }>;

/**
 * Raised when another pass already owns this runs directory.
 */
export class RunsDirectoryBusyError extends Error {
  /**
   * Declares this message safe to forward: it names a process id, its start time and the directory.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Names the holder and the two ways forward.
   *
   * @param runsDir - directory whose lock is held
   *
   * @param holder - what the lock file records, absent when unreadable
   *
   * @example
   * ```ts
   * throw new RunsDirectoryBusyError({ runsDir, holder, },);
   * ```
   */
  constructor(
    {
      runsDir,
      holder,
    }: {
      readonly runsDir: string;
      readonly holder?: LockHolder;
    },
  ) {
    super(
      [
        `Another pass is running in ${runsDir}.`,
        ...(holder === undefined
          ? ['  its lock file records nothing readable',]
          : [
            `  process ${String(holder.pid,)}, since ${holder.startedAt}`,
          ]),
        '',
        'Two passes sharing one runs directory do not conflict loudly. They',
        'overwrite each other\'s attempt counts, delete each other\'s cached',
        'slices whenever their pipelines differ, and the later write of any',
        'entry simply replaces the earlier one. Every one of those looks like',
        'ordinary output.',
        '',
        'Point this run at another directory with TRANSLATION_REPAIR_RUNS_DIR,',
        'or stop the other pass. A lock whose process is gone is taken over',
        'automatically, so this means the holder is alive.',
      ].join('\n',),
    );
    this.name = 'RunsDirectoryBusyError';
  }
}

/**
 * Whether a process id is alive.
 *
 * Signal zero performs the permission and existence checks without delivering
 * anything, so it answers exactly this question. A process owned by another
 * user answers EPERM, which is still alive.
 *
 * @param pid - process id from a lock file
 *
 * @returns Whether something is running under it
 *
 * @example
 * ```ts
 * const held = isAlive({ pid: 1234, },);
 * ```
 */
function isAlive({ pid, }: { readonly pid: number; },): boolean {
  try {
    process.kill(
      pid,
      0,
    );
    return true;
  }
  catch (error) {
    // EPERM means it exists and belongs to someone else, which is held rather
    // than free. Logged rather than swallowed, since taking a lock away from a
    // live process is the one outcome this must never produce silently.
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'EPERM')) {
      console.log(
        `LOCK process ${String(pid,)} exists but is not ours; treating the lock as held`,
      );
      return true;
    }
    return false;
  }
}

/**
 * Reads what a lock file claims, or nothing when it claims nothing readable.
 *
 * @param path - lock file path
 *
 * @returns Holder it records, absent when the file is unreadable or malformed
 *
 * @example
 * ```ts
 * const holder = await readHolder({ path, },);
 * ```
 */
async function readHolder(
  { path, }: { readonly path: string; },
): Promise<HolderRead> {
  try {
    /**
     * Lock file contents as parsed JSON.
     */
    const parsed: unknown = await readRunJson({ path, },);

    if (((typeof parsed) !== 'object') || (parsed === null))
      return { kind: 'unreadable', };
    if ((!('pid' in parsed)) || ((typeof parsed.pid) !== 'number'))
      return { kind: 'unreadable', };
    if ((!('startedAt' in parsed)) || ((typeof parsed.startedAt) !== 'string'))
      return { kind: 'unreadable', };

    return {
      kind: 'holder',
      holder: {
        pid: parsed.pid,
        startedAt: parsed.startedAt,
        token: (('token' in parsed) && ((typeof parsed.token) === 'string')) ? parsed.token : '',
      },
    };
  }
  catch (error) {
    // A lock file that cannot be read is not a lock anyone can respect, and
    // saying so is better than either honouring it forever or ignoring it
    // silently.
    console.log(`LOCK ${path} unreadable (${refusalText({ error, },)})`,);
    return { kind: 'unreadable', };
  }
}

/**
 * Tries to create the lock file, failing rather than overwriting.
 *
 * `wx` makes the check and the claim ONE filesystem operation, which is the
 * whole mechanism: checking for the file and then creating it leaves a window
 * in which two passes both see it absent and both proceed.
 *
 * @param path - lock file path
 *
 * @param holder - what to record inside it
 *
 * @returns Whether this call created it
 *
 * @example
 * ```ts
 * const won = await claim({ path, holder, },);
 * ```
 */
async function claim(
  {
    path,
    holder,
  }: {
    readonly path: string;
    readonly holder: LockHolder;
  },
): Promise<boolean> {
  try {
    /**
     * Handle from an exclusive create, which fails when the file is there.
     */
    const handle = await open(
      path,
      'wx',
    );
    await handle.writeFile(`${JSON.stringify(holder,)}\n`,);
    await handle.close();
    return true;
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'EEXIST'))
      return false;
    throw error;
  }
}

/**
 * Takes exclusive ownership of a runs directory for the life of a scope.
 *
 * Created with `wx`, so the check and the claim are one filesystem operation
 * and two passes starting together cannot both win. A lock whose process is
 * gone is taken over, since a pass killed at its hard cap leaves one behind and
 * refusing forever would make every crash need manual cleanup.
 *
 * @param runsDir - durable output root this pass owns
 *
 * @returns Disposable releasing the lock
 *
 * @throws RunsDirectoryBusyError when a live process already holds it
 *
 * @example
 * ```ts
 * await using _lock = await lockRunsDir({ runsDir, },);
 * ```
 */
export async function lockRunsDir(
  { runsDir, }: { readonly runsDir: string; },
): Promise<AsyncDisposable> {
  // The directory has to exist before anything in it can be opened, and this is
  // the FIRST thing a pass touches. Without this a fresh runs directory fails
  // outright with ENOENT on the lock file, which reads as a locking problem
  // rather than as a missing directory and sends a reader to the wrong module.
  // A pass pointed at a new directory is ordinary: it is how a run is kept to
  // one pipeline generation.
  await mkdir(
    runsDir,
    { recursive: true, },
  );

  /**
   * Path of the lock file this pass competes for.
   */
  const path = join(
    runsDir,
    LOCK_FILE,
  );

  /**
   * What this pass writes into the lock file.
   */
  const holder: LockHolder = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  };

  if (!await claim({
    path,
    holder,
  },)) {
    /**
     * Whoever the existing lock names.
     */
    const existing = await readHolder({ path, },);

    if (existing.kind === 'holder') {
      /**
       * Process the existing lock names.
       */
      const { holder: heldBy, } = existing;

      if (isAlive({ pid: heldBy.pid, },))
        throw new RunsDirectoryBusyError({
          runsDir,
          holder: heldBy,
        },);

      console.log(
        `LOCK taking over a stale lock in ${runsDir} from gone process ${
          String(heldBy.pid,)
        }`,
      );
    }
    else
      console.log(`LOCK taking over an unreadable lock in ${runsDir}`,);

    await evictStaleLock({ path, },);

    // ONE retry, not a loop and not recursion. Two passes finding the same
    // stale lock both try to evict it; the eviction is a rename, so exactly
    // one of them evicts and the other finds it gone, then exactly one create
    // succeeds and the loser faces a live holder rather than a stale one, so
    // retrying again could only spin against a lock that is genuinely held.
    if (!await claim({
      path,
      holder,
    },)) {
      /**
       * Whoever won the race this pass lost.
       */
      const winner = await readHolder({ path, },);

      throw new RunsDirectoryBusyError({
        runsDir,
        ...(winner.kind === 'unreadable' ? {} : { holder: winner.holder, }),
      },);
    }
  }

  return {
    async [Symbol.asyncDispose](): Promise<void> {
      await releaseIfOwned({
        path,
        holder,
      },);
    },
  };
}

/**
 * Removes a stale lock so that exactly one of any number of concurrent
 * starters does it.
 *
 * A RENAME, NOT A REMOVE. Two starters that both found the lock stale and both
 * removed it could interleave as remove, claim, remove, claim, the second
 * remove deleting the first starter's fresh lock, and both passes then ran in
 * one directory (`#243`). A rename to a name only this call knows is atomic:
 * the first starter's rename succeeds and the second's finds nothing to
 * rename, so the second proceeds straight to a claim it will lose.
 *
 * @param path - lock file to evict
 *
 * @returns `evicted` when this call moved the lock aside, `gone` when another
 * starter had already done so
 *
 * @example
 * ```ts
 * const outcome = await evictStaleLock({ path, },);
 * ```
 *
 * @internal
 */
export async function evictStaleLock(
  { path, }: { readonly path: string; },
): Promise<'evicted' | 'gone'> {
  /**
   * Name only this call knows, so two evictions cannot collide on it either.
   */
  const asideName = `${path}.stale-${randomUUID()}`;
  try {
    await rename(
      path,
      asideName,
    );
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return 'gone';
    throw error;
  }
  await rm(
    asideName,
    { force: true, },
  );
  return 'evicted';
}

/**
 * Removes the lock file only when it still carries this acquisition's token,
 * so a starter that lost a takeover cannot delete the winner's lock on its
 * way out (`#243`). Says so when it keeps one.
 *
 * @param path - lock file
 *
 * @param holder - holder this acquisition wrote
 *
 * @returns `released` when the file was ours and is gone, `kept` otherwise
 *
 * @example
 * ```ts
 * const outcome = await releaseIfOwned({ path, holder, },);
 * ```
 *
 * @internal
 */
export async function releaseIfOwned(
  {
    path,
    holder,
  }: {
    readonly path: string;
    readonly holder: LockHolder;
  },
): Promise<'released' | 'kept'> {
  /**
   * Whoever holds the file now.
   */
  const current = await readHolder({ path, },);
  if (current.kind === 'holder') {
    /**
     * Holder the file names now.
     */
    const { holder: found, } = current;
    if (found.token === holder.token) {
      await rm(
        path,
        { force: true, },
      );
      return 'released';
    }
  }
  console.log(`LOCK ${path} is not this acquisition's any more; leaving it in place`,);
  return 'kept';
}

//endregion Runs lock
