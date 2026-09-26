/**
 Wrapper commit processes and lock-hold observation for the concurrent-commit benchmark.

 Lock holds are read from inotify rename events through `fs.watch`:
 the landing lock is published and released by renames of `landing.lock`,
 and Git creates and renames or deletes `index.lock`,
 so each lock's events alternate between appearing and disappearing,
 and consecutive pairs are hold intervals.

 @module
 */
import {
  spawn,
} from 'node:child_process';
import { once, } from 'node:events';
import { watch, } from 'node:fs';
import { access, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  type CommitObservation,
  NANOSECONDS_PER_MILLISECOND,
  PACKAGE_BIN,
} from './concurrent-commit-latency-contracts.ts';

/**
 Collected lock hold intervals.
 */
export type LockHolds = Readonly<{
  /**
   Landing lock holds.
   */
  landingLockHoldMs: readonly number[];
  /**
   Real `index.lock` holds.
   */
  indexLockHoldMs: readonly number[];
}>;

/**
 Running lock observer.
 */
export type LockObserver = Readonly<{
  /**
   Stops watching and pairs the recorded toggles into hold intervals.
   */
  stop: () => LockHolds;
}>;

/**
 Reports whether a path exists.

 @param path - probed path

 @returns whether it exists

 @example
 ```ts
 await pathExists('/work/concurrent/disjoint/.git');
 ```
 */
export async function pathExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 Monotonic milliseconds.

 @returns current monotonic time

 @example
 ```ts
 const started = nowMs();
 ```
 */
export function nowMs(): number {
  return Number(process.hrtime
    .bigint(),) / NANOSECONDS_PER_MILLISECOND;
}

/**
 Pairs alternating appear and disappear times into hold intervals.

 @param toggles - event times in order

 @param heldAtStart - whether the lock existed when watching began

 @returns hold intervals; an unmatched final appearance is dropped
 */
function holdIntervals({
  toggles,
  heldAtStart,
}: Readonly<{
  toggles: readonly number[];
  heldAtStart: boolean;
}>,): readonly number[] {
  /**
   Toggles starting with an appearance.
   */
  const aligned = heldAtStart ? toggles.slice(1,) : toggles;
  return Array.from(
    { length: Math.floor(aligned.length / 2,), },
    function interval(
      _unused,
      index,
    ): number {
      return (aligned[(2 * index) + 1] ?? 0) - (aligned[2 * index] ?? 0);
    },
  );
}

/**
 Watches one directory for renames of one entry name.

 @param directory - watched directory

 @param name - entry name

 @returns toggle times, whether the entry existed at start, and a closer
 */
async function watchEntry({
  directory,
  name,
}: Readonly<{
  directory: string;
  name: string;
}>,): Promise<Readonly<{
  toggles: number[];
  heldAtStart: boolean;
  close: () => void;
}>> {
  /**
   Event times in order.
   */
  const toggles: number[] = [];
  if (!(await pathExists(directory,)))
    // A repository before its first wrapped commit has no transaction root to watch.
    return {
      toggles,
      heldAtStart: false,
      close: function closeNothing(): void {
        toggles.length = 0;
      },
    };
  /**
   Directory watcher.
   */
  const watcher = watch(
    directory,
    function recordToggle(
      eventType,
      filename,
    ): void {
      if ((eventType === 'rename') && (filename === name))
        toggles.push(nowMs(),);
    },
  );
  return {
    toggles,
    heldAtStart: await pathExists(join(
      directory,
      name,
    ),),
    close: function closeWatcher(): void {
      watcher.close();
    },
  };
}

/**
 Starts observing a repository's landing lock and real `index.lock`.

 @param repository - repository path

 @returns running observer

 @example
 ```ts
 const observer = await observeLocks('/work/concurrent/default');
 const holds = observer.stop();
 ```
 */
export async function observeLocks(repository: string,): Promise<LockObserver> {
  /**
   Landing lock watch.
   */
  const landing = await watchEntry({
    directory: join(
      repository,
      '.git',
      'cli-git-transactions',
    ),
    name: 'landing.lock',
  },);
  /**
   Real index lock watch.
   */
  const index = await watchEntry({
    directory: join(
      repository,
      '.git',
    ),
    name: 'index.lock',
  },);
  return {
    stop: function stopObserver(): LockHolds {
      landing.close();
      index.close();
      return {
        landingLockHoldMs: holdIntervals(landing,),
        indexLockHoldMs: holdIntervals(index,),
      };
    },
  };
}

/**
 Counts JSONL events of one type in wrapper stdout.

 @param stdout - captured stdout

 @param type - event type

 @returns event count
 */
function countEvents({
  stdout,
  type,
}: Readonly<{
  stdout: string;
  type: string;
}>,): number {
  return stdout
    .split('\n',)
    .filter(function isEvent(line,): boolean {
      return line.startsWith('{',) && line.includes(`"type":"${type}"`,);
    },)
    .length;
}

/**
 Runs one wrapped commit to exit and observes it.

 @param repository - repository path

 @param args - wrapper arguments

 @param env - additional environment

 @param command - executable, the packed wrapper unless a direct-Git baseline

 @returns commit observation

 @example
 ```ts
 await runCommit({ repository, args: ['commit', '--quiet', '-m', 'x', '--', 'files/f-0.txt'] });
 ```
 */
export async function runCommit({
  repository,
  args,
  env = {},
  command = PACKAGE_BIN,
}: Readonly<{
  repository: string;
  args: readonly string[];
  env?: Readonly<Record<string, string>>;
  command?: string;
}>,): Promise<CommitObservation> {
  /**
   Spawn time.
   */
  const startedAt = nowMs();
  /**
   Commit process.
   */
  const child = spawn(
    command,
    [...args,],
    {
      cwd: repository,
      env: {
        ...process.env,
        ...env,
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   Captured stdout chunks.
   */
  const chunks: Buffer[] = [];
  child.stdout
    .on(
    'data',
    function collect(chunk: Buffer,): void {
      chunks.push(chunk,);
    },
  );
  /**
   Captured stderr chunks.
   */
  const errorChunks: Buffer[] = [];
  child.stderr
    .on(
      'data',
      function collectError(chunk: Buffer,): void {
        errorChunks.push(chunk,);
      },
    );
  await once(
    child,
    'close',
  );
  /**
   Complete stdout.
   */
  const stdout = Buffer.concat(chunks,)
    .toString('utf8',);
  return {
    completionMs: nowMs() - startedAt,
    exitCode: child.exitCode ?? (-1),
    ...(child.exitCode === 0
      ? {}
      : {
        failureOutput: `${stdout}${Buffer.concat(errorChunks,)
          .toString('utf8',)}`,
      }),
    lostRaces: countEvents({
      stdout,
      type: 'landing-race-lost',
    },),
    replays: countEvents({
      stdout,
      type: 'commit-replayed',
    },),
    coreFinding: countEvents({
      stdout,
      type: 'core-finding',
    },) > 0,
  };
}
