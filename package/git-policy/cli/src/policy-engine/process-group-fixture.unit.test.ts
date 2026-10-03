/**
 Process groups that fixture processes run in, killed whole when the fixture is disposed.

 Each fixture process starts detached as the leader of its own process group,
 so the hooks,
 editors,
 and native Git it starts share the group and outlive neither the fixture nor this test process.
 A killed leader leaves the group alive when a member remains,
 which a kill by process tree would miss once the members are reparented to init.
 A test process that exits,
 or ends through `SIGINT`,
 `SIGTERM`,
 or `SIGHUP`,
 kills every group still registered;
 only a `SIGKILL` of the test process itself leaves them running.

 @module
 */
import {
  type ChildProcess,
  spawn,
  type SpawnOptions,
} from 'node:child_process';
import { wait, } from '@monochromatic-dev/module-async-time/ts';

/**
 How long a killed group may take to disappear before disposal gives up waiting.
 */
const GROUP_GONE_DEADLINE_MS = 5_000;

/**
 Poll interval while waiting for a killed group to disappear.
 */
const GROUP_GONE_POLL_MS = 10;

/**
 Signals that end a test process and, before it ends, every registered group.
 */
const ENDING_SIGNALS: readonly NodeJS.Signals[] = [
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
];

/**
 Groups registered by every live fixture in this test process.
 */
const registeredGroups = new Set<number>();

/**
 Whether the exit and signal handlers are installed, installed once on first registration.
 */
const handlers = new Set<'installed'>();

/**
 Sends `SIGKILL` to a process group and reports whether the group still had a member.

 @param group - process group ID, the leader's PID

 @returns whether a member received the signal
 */
function killGroup(group: number,): boolean {
  try {
    process.kill(
      -group,
      'SIGKILL',
    );
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ESRCH'))
      return false;
    throw error;
  }
}

/**
 Reports whether a process group still has a member, a zombie awaiting its reaper included.

 @param group - process group ID

 @returns whether any member remains
 */
function groupExists(group: number,): boolean {
  try {
    process.kill(
      -group,
      0,
    );
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ESRCH'))
      return false;
    throw error;
  }
}

/**
 Kills every registered group synchronously, as an exit handler must.
 */
function killRegisteredGroups(): void {
  for (const group of registeredGroups)
    killGroup(group,);
  registeredGroups.clear();
}

/**
 Kills every registered group, then lets the signal end this process as it would have without the handler.

 @param signal - ending signal
 */
function killGroupsThenReraise(signal: NodeJS.Signals,): void {
  killRegisteredGroups();
  for (const ending of ENDING_SIGNALS)
    process.removeListener(ending, killGroupsThenReraise,);
  process.kill(
    process.pid,
    signal,
  );
}

/**
 Installs the exit and signal handlers once.
 */
function installHandlers(): void {
  if (handlers.size > 0)
    return;
  handlers.add('installed',);
  process.once('exit', killRegisteredGroups,);
  for (const signal of ENDING_SIGNALS)
    process.once(signal, killGroupsThenReraise,);
}

/**
 Waits, up to the deadline, until a killed group has no member left.

 @param group - process group ID

 @throws {@link Error} when a member outlives the deadline
 */
async function awaitGroupGone(group: number,): Promise<void> {
  /** Deadline. */
  const deadline = Date.now() + GROUP_GONE_DEADLINE_MS;
  while (groupExists(group,)) {
    if (Date.now() > deadline)
      throw new Error(`Process group ${String(group,)} survived SIGKILL for ${String(GROUP_GONE_DEADLINE_MS,)} ms.`,);
    // oxlint-disable-next-line no-await-in-loop -- Poll delay between existence checks.
    await wait(GROUP_GONE_POLL_MS,);
  }
}

/**
 Process groups owned by one fixture.
 */
export type ProcessGroups = AsyncDisposable & Readonly<{
  /**
   Starts a process as the leader of a new registered group.
   */
  spawn: (request: Readonly<{
    /**
     Executable.
     */
    command: string;
    /**
     Arguments.
     */
    args: readonly string[];
    /**
     Spawn options; `detached` is always set.
     */
    options: Omit<SpawnOptions, 'detached'>;
  }>) => ChildProcess;
}>;

/**
 Creates the process-group registry of one fixture; disposing it kills every group it started.

 @returns registry

 @example
 ```ts
 await using groups = createProcessGroups();
 const child = groups.spawn({ command: process.execPath, args: ['hook.cjs'], options: { stdio: 'ignore' } });
 ```
 */
export function createProcessGroups(): ProcessGroups {
  /** Groups this fixture started. */
  const owned = new Set<number>();
  return {
    spawn: function spawnGroupLeader({
      command,
      args,
      options,
    },): ChildProcess {
      installHandlers();
      /** Group leader. */
      const child = spawn(
        command,
        [...args,],
        {
          ...options,
          detached: true,
        },
      );
      if (child.pid !== undefined) {
        owned.add(child.pid,);
        registeredGroups.add(child.pid,);
      }
      return child;
    },
    [Symbol.asyncDispose]: async function killOwnedGroups(): Promise<void> {
      /** Groups that still had a member. */
      const killed = [...owned,].filter(killGroup,);
      for (const group of owned)
        registeredGroups.delete(group,);
      owned.clear();
      await Promise.all(killed.map(awaitGroupGone,),);
    },
  };
}
