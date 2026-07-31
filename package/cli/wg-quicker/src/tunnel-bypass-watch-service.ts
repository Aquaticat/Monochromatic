import { spawn as spawnChild, } from 'node:child_process';
import {
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { BypassRouteError, } from './errors.ts';
import { bypassStatePath, } from './tunnel-bypass-path.ts';
import type { BypassState, } from './tunnel-bypass-types.ts';

/**
 * Source or built watcher filename adjacent to current artifact.
 */
const WATCHER_FILENAME = import.meta.url
  .endsWith('.ts',)
  ? 'bypass-watch.ts'
  : 'bypass-watch.mjs';

/**
 * Absolute watcher entry path.
 */
const WATCHER_PATH = new URL(
  WATCHER_FILENAME,
  import.meta.url,
).pathname;

/**
 * Sentinel representing absent process or identity file.
 */
const PROCESS_ABSENT = Symbol('bypass watcher process is absent',);

/**
 * Readiness and shutdown retry count.
 */
const PROCESS_WAIT_ATTEMPTS = 100;

/**
 * Delay between bounded process identity probes.
 */
const PROCESS_WAIT_DELAY_MS = 10;

/**
 * Zero-based start-time offset after proc stat command field.
 */
const PROC_START_TIME_OFFSET = 19;

/**
 * Persisted watcher process identity resistant to PID reuse.
 */
type WatcherProcessIdentity = {
  readonly pid: number;
  readonly startTime: string;
};

/**
 * Narrows caught value to Node filesystem or process error.
 *
 * @param error - Caught value.
 *
 * @returns Whether value carries error code.
 *
 * @example
 * ```ts
 * isErrnoException({ code: 'ENOENT' }); // true
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return ((typeof error) === 'object')
    && (error !== null)
    && ('code' in error);
}

/**
 * Resolves watcher identity sidecar for state path.
 *
 * @param statePath - Persisted bypass state path.
 *
 * @returns Watcher identity path.
 *
 * @example
 * ```ts
 * watcherIdentityPath({ statePath: '/run/wg-quicker/interface.json' });
 * ```
 */
function watcherIdentityPath(
  { statePath, }: { readonly statePath: string; },
): string {
  return `${statePath}.watcher.json`;
}

/**
 * Reads Linux process start-time ticks used to reject PID reuse.
 *
 * @param pid - Process identifier.
 *
 * @returns Start-time field or absence when process no longer exists.
 *
 * @example
 * ```ts
 * await processStartTime({ pid: process.pid });
 * ```
 */
async function processStartTime(
  { pid, }: { readonly pid: number; },
): Promise<string | typeof PROCESS_ABSENT> {
  try {
    /**
     * Proc stat text whose command field may contain spaces and parentheses.
     */
    const stat = await readFile(
      `/proc/${String(pid,)}/stat`,
      'utf8',
    );
    /**
     * End of parenthesized command field.
     */
    const commandEnd = stat.lastIndexOf(')',);
    if (commandEnd === (-1))
      throw new BypassRouteError(`Cannot parse process identity for PID ${String(pid,)}.`,);
    /**
     * Fields beginning with process state,
     * which is proc field three.
     */
    const fields = stat.slice(commandEnd + 2,)
      .split(' ',);
    /**
     * Start time is proc field twenty-two,
     * index nineteen after field three.
     */
    const startTime = fields.at(PROC_START_TIME_OFFSET,);
    if (startTime === undefined)
      throw new BypassRouteError(`Process identity lacks start time for PID ${String(pid,)}.`,);
    return startTime;
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return PROCESS_ABSENT;
    throw error;
  }
}

/**
 * Reads watcher identity sidecar when present.
 *
 * @param statePath - Persisted bypass state path.
 *
 * @returns Validated identity or absence.
 *
 * @example
 * ```ts
 * await readWatcherIdentity({ statePath: '/run/wg-quicker/interface.json' });
 * ```
 */
async function readWatcherIdentity(
  { statePath, }: { readonly statePath: string; },
): Promise<WatcherProcessIdentity | typeof PROCESS_ABSENT> {
  try {
    /**
     * Parsed sidecar before shape checks.
     */
    const value: unknown = JSON.parse(await readFile(
      watcherIdentityPath({ statePath, },),
      'utf8',
    ),);
    if (((typeof value) !== 'object')
      || (value === null)
      || (!('pid' in value))
      || (!('startTime' in value))
      || ((typeof value.pid) !== 'number')
      || ((typeof value.startTime) !== 'string')) {
      throw new BypassRouteError(`Invalid bypass watcher identity for ${statePath}.`,);
    }
    return {
      pid: value.pid,
      startTime: value.startTime,
    };
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return PROCESS_ABSENT;
    throw error;
  }
}

/**
 * Sends signal while tolerating process disappearance.
 *
 * @param pid - Process identifier.
 *
 * @param signal - Signal name.
 *
 * @example
 * ```ts
 * signalProcess({ pid: 123, signal: 'SIGTERM' });
 * ```
 */
function signalProcess(
  {
    pid,
    signal,
  }: {
    readonly pid: number;
    readonly signal: NodeJS.Signals;
  },
): void {
  try {
    process.kill(
      pid,
      signal,
    );
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ESRCH'))
      return;
    throw error;
  }
}

/**
 * Registers current watcher identity and removes it on exit.
 *
 * @param statePath - Persisted bypass state path.
 *
 * @returns Asynchronous cleanup guard.
 *
 * @example
 * ```ts
 * await using registration = await registerBypassWatcher({ statePath });
 * ```
 */
export async function registerBypassWatcher(
  { statePath, }: { readonly statePath: string; },
): Promise<AsyncDisposable> {
  /**
   * Current process start time.
   */
  const startTime = await processStartTime({ pid: process.pid, },);
  if (startTime === PROCESS_ABSENT)
    throw new BypassRouteError('Current watcher process disappeared during registration.',);
  /**
   * Sidecar path owned by this watcher.
   */
  const path = watcherIdentityPath({ statePath, },);
  await writeFile(
    path,
    JSON.stringify({
      pid: process.pid,
      startTime,
    },),
    {
      flag: 'wx',
      mode: 0o600,
    },
  );
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      /**
       * Current sidecar identity before owner removal.
       */
      const current = await readWatcherIdentity({ statePath, },);
      if ((current !== PROCESS_ABSENT)
        && (current.pid === process.pid)
        && (current.startTime === startTime)) {
        await rm(path,);
      }
    },
  };
}

/**
 * Stops detached watcher only when PID start time still matches sidecar.
 *
 * @param state - Persisted bypass state.
 *
 * @example
 * ```ts
 * await stopBypassWatcher({ state });
 * ```
 */
export async function stopBypassWatcher(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  /**
   * Persisted state path and watcher identity.
   */
  const statePath = bypassStatePath({ interfaceName: state.interfaceName, },);
  /**
   * Registered watcher when present.
   */
  const identity = await readWatcherIdentity({ statePath, },);
  if (identity === PROCESS_ABSENT)
    return;
  /**
   * Live start time for PID reuse guard.
   */
  const liveStartTime = await processStartTime({ pid: identity.pid, },);
  if ((liveStartTime === PROCESS_ABSENT) || (liveStartTime !== identity.startTime)) {
    await rm(
      watcherIdentityPath({ statePath, },),
      { force: true, },
    );
    return;
  }
  signalProcess({
    pid: identity.pid,
    signal: 'SIGTERM',
  },);
  /**
   * Bounded graceful-stop cursor.
   */
  const cursor = { attempt: 0, };
  while (cursor.attempt < PROCESS_WAIT_ATTEMPTS) {
    /**
     * Live identity during graceful-stop wait.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process identity must be rechecked after each bounded delay.
    const current = await processStartTime({ pid: identity.pid, },);
    if ((current === PROCESS_ABSENT) || (current !== identity.startTime))
      break;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bounded process shutdown wait avoids busy spin.
    await wait(PROCESS_WAIT_DELAY_MS,);
    cursor.attempt += 1;
  }
  if ((await processStartTime({ pid: identity.pid, })) === identity.startTime) {
    signalProcess({
      pid: identity.pid,
      signal: 'SIGKILL',
    },);
  }
  await rm(
    watcherIdentityPath({ statePath, },),
    { force: true, },
  );
}

/**
 * Starts detached watcher in caller's network namespace and verifies registration.
 *
 * @param state - Persisted bypass state.
 *
 * @example
 * ```ts
 * await startBypassWatcher({ state });
 * ```
 */
export async function startBypassWatcher(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  await stopBypassWatcher({ state, },);
  /**
   * Persisted state path passed to watcher.
   */
  const statePath = bypassStatePath({ interfaceName: state.interfaceName, },);
  /**
   * Detached watcher inheriting caller's network namespace and privileges.
   */
  const watcher = spawnChild(
    process.execPath,
    [
      WATCHER_PATH,
      statePath,
    ],
    {
      detached: true,
      stdio: 'ignore',
    },
  );
  watcher.unref();
  /**
   * Bounded readiness cursor.
   */
  const cursor = { attempt: 0, };
  while (cursor.attempt < PROCESS_WAIT_ATTEMPTS) {
    /**
     * Child registration identity during readiness wait.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- Registration sidecar is asynchronous child readiness boundary.
    const identity = await readWatcherIdentity({ statePath, },);
    if ((identity !== PROCESS_ABSENT) && (identity.pid === watcher.pid))
      return;
    if (watcher.exitCode !== null)
      throw new BypassRouteError(`Bypass route watcher exited during startup with ${String(watcher.exitCode,)}.`,);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bounded readiness wait avoids busy spin.
    await wait(PROCESS_WAIT_DELAY_MS,);
    cursor.attempt += 1;
  }
  signalProcess({
    pid: watcher.pid ?? (-1),
    signal: 'SIGKILL',
  },);
  throw new BypassRouteError('Bypass route watcher did not register process identity.',);
}
