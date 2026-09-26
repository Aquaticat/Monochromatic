/**
 Disposing a landing repository ends every process its fixtures started,
 so a test that fails or is abandoned mid-barrier leaves no hook, editor, or native Git waiting in a removed repository.

 @module
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { holdNativeCommitAll, } from '../index-lock/index-lock-fixture.unit.test.ts';
import {
  barrierSource,
  createLandingRepository,
  git,
  startWrapper,
  waitForFile,
  writeHook,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

/**
 How long a killed process may take to disappear.
 */
const GONE_DEADLINE_MS = 5_000;

/**
 Poll interval while waiting for a process to disappear.
 */
const GONE_POLL_MS = 20;

/**
 Reports whether a process still runs; a zombie awaiting its reaper counts as gone.

 @param pid - process

 @returns whether it runs
 */
async function runs(pid: number,): Promise<boolean> {
  try {
    /** Stat line. */
    const stat = await readFile(`/proc/${String(pid,)}/stat`, 'utf8',);
    return !['Z', 'X',].includes(stat.slice(stat.lastIndexOf(')',) + 2,).split(' ',)[0] ?? '',);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && ((error.code === 'ENOENT') || (error.code === 'ESRCH')))
      return false;
    throw error;
  }
}

/**
 Waits until none of the processes runs, up to the deadline.

 @param pids - processes

 @returns processes still running at the deadline
 */
async function survivors(pids: readonly number[],): Promise<readonly number[]> {
  /** Deadline. */
  const deadline = Date.now() + GONE_DEADLINE_MS;
  for (;;) {
    /** Processes still running. */
    // oxlint-disable-next-line no-await-in-loop -- Each poll observes the processes after the previous delay.
    const running = (await Promise.all(pids.map(async function probe(pid,): Promise<readonly number[]> {
      return (await runs(pid,)) ? [pid,] : [];
    },),)).flat();
    if ((running.length === 0) || (Date.now() > deadline))
      return running;
    // oxlint-disable-next-line no-await-in-loop -- Poll delay.
    await wait(GONE_POLL_MS,);
  }
}

/**
 Kills processes a failed assertion left behind, so this test itself leaves nothing.

 @param pids - processes

 @returns disposable that kills them
 */
function killOnExit(pids: readonly number[],): Disposable {
  return {
    [Symbol.dispose]: function killLeftovers(): void {
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL',);
        }
        catch (error: unknown) {
          if (!(Error.isError(error,) && ('code' in error) && (error.code === 'ESRCH')))
            throw error;
        }
      }
    },
  };
}

/**
 Reads the PID a barrier wrote into its readiness marker.

 @param ready - readiness marker

 @returns barrier process PID
 */
async function barrierPid(ready: string,): Promise<number> {
  await waitForFile({ path: ready, },);
  return Number(await readFile(ready, 'utf8',),);
}

await describe({
  name: 'landing fixture teardown',
  children: [
    it({
      name: 'disposing the repository ends a wrapped commit and its hook still waiting at a barrier',
      fn: async function testWrapperHook(): Promise<void> {
        /** Repository disposed by the test body. */
        const repository = await createLandingRepository();
        /** Hook readiness marker. */
        const ready = join(repository.scratch, 'hook.ready',);
        await writeHook({ repository, event: 'pre-commit', source: barrierSource({ ready, release: join(repository.scratch, 'never',), },), },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Wrapped commit left waiting in its hook. */
        const wrapper = startWrapper({ repository, args: ['commit', '-m', 'a', 'a.txt',], },);
        /** Hook PID. */
        const hook = await barrierPid(ready,);
        /** Every process the commit started that the test knows by PID. */
        const pids = [wrapper.pid ?? (-1), hook,];
        using _killed = killOnExit(pids,);
        await repository[Symbol.asyncDispose]();
        expect(await survivors(pids,),).toEqual([],);
      },
    },),
    it({
      name: 'disposing the repository ends a native commit --all and its editor holding index.lock',
      fn: async function testNativeHolder(): Promise<void> {
        /** Repository disposed by the test body. */
        const repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'base.txt', content: 'native\n', },);
        /** Native Git held in its editor. */
        const native = await holdNativeCommitAll({ repository, name: 'held', lockfilePid: true, message: 'native\n', },);
        /** Editor PID. */
        const editor = await barrierPid(join(repository.scratch, 'held.ready',),);
        /** Native Git and its editor. */
        const pids = [native.pid, editor,];
        using _killed = killOnExit(pids,);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('baseline',);
        await repository[Symbol.asyncDispose]();
        expect(await survivors(pids,),).toEqual([],);
      },
    },),
  ],
},);
