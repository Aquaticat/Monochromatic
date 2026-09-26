/**
 A zombie lock owner: a process that exited but was never reaped.

 Inside a container whose init does not reap orphans,
 a `SIGKILL`ed process group leaves zombies,
 and a zombie still answers `kill(pid, 0)` and keeps its `/proc/<pid>/stat` start time.

 @module
 */
import {
  type ChildProcess,
  spawn,
} from 'node:child_process';
import { once, } from 'node:events';
import { readFile, } from 'node:fs/promises';
import { wait, } from '@monochromatic-dev/module-async-time/ts';

/**
 A zombie and its non-reaping parent.
 */
export type ZombieOwner = Readonly<{
  /**
   Zombie PID.
   */
  pid: number;
  /**
   Birth identity recorded while it still ran.
   */
  identity: string;
  /**
   Kills the parent, so init reaps the zombie.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Reads the Linux process state letter.

 @param pid - process

 @returns state letter, empty when the process is gone
 */
async function processState(pid: number,): Promise<string> {
  try {
    /**
     Stat line.
     */
    const stat = await readFile(`/proc/${String(pid,)}/stat`, 'utf8',);
    return stat.slice(stat.lastIndexOf(')',) + 2,).split(' ',)[0] ?? '';
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return '';
    throw error;
  }
}

/**
 Starts a short-lived child under a parent that never reaps it, records its identity, and waits until it is a zombie.

 The parent is `sh`, which starts the child in the background and then replaces itself with `sleep`,
 a program that never waits for children.

 @param resolveIdentity - birth identity resolver under test, read while the child runs

 @returns zombie handle

 @example
 ```ts
 await using zombie = await startZombie(resolveProcessBirthIdentity);
 ```
 */
export async function startZombie(resolveIdentity: (pid: number) => Promise<string | symbol>,): Promise<ZombieOwner> {
  /**
   Parent that becomes `sleep` and never reaps its child.
   */
  const parent: ChildProcess = spawn('sh', ['-c', '(sleep 1) & echo "$!"; exec sleep 60',], { stdio: ['ignore', 'pipe', 'ignore',], },);
  /**
   Child PID printed by the parent.
   */
  const pid = Number((await once(parent.stdout ?? parent, 'data',) as readonly Buffer[])[0]?.toString('utf8',).trim(),);
  /**
   Identity while the child runs.
   */
  const identity = await resolveIdentity(pid,);
  if ((typeof identity) !== 'string')
    throw new Error(`Zombie stand-in ${String(pid,)} exited before its identity was read.`,);
  for (let polls = 0; ; polls += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Polling observes the state change in order.
    if ((await processState(pid,)) === 'Z')
      break;
    if (polls > 500)
      throw new Error(`Process ${String(pid,)} never became a zombie.`,);
    // oxlint-disable-next-line no-await-in-loop -- Poll delay between state reads.
    await wait(10,);
  }
  return {
    pid,
    identity,
    async [Symbol.asyncDispose](): Promise<void> {
      /**
       Parent exit.
       */
      const exited = once(parent, 'exit',);
      parent.kill('SIGKILL',);
      await exited;
    },
  };
}
