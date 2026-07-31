import { spawn as spawnChild, } from 'node:child_process';
import { once, } from 'node:events';
import { mkdir, } from 'node:fs/promises';
import { createInterface, } from 'node:readline';
import { text, } from 'node:stream/consumers';

import { BypassStateError, } from './errors.ts';
import {
  bypassRuntimeDirectory,
  bypassStateKey,
} from './tunnel-bypass-path.ts';

/**
 * Exit status distinguishing lock contention from command failure.
 */
const LOCK_CONFLICT_EXIT_CODE = 75;

/**
 * Readiness line emitted only after `flock` acquires operation lock.
 */
const LOCK_READY_LINE = 'wg-quicker-operation-lock-ready';

/**
 * Long timer retaining lock-holder process without polling.
 */
const LOCK_PARENT_PROBE_MS = 100;

/**
 * JavaScript run after `flock --no-fork` acquires lock.
 *
 * Holder exits through uncaught error when parent disappears,
 * releasing kernel lock after caller crash.
 */
const LOCK_HOLDER_SOURCE = `const ownerPid = ${String(process.pid,)}; process.stdout.write('${LOCK_READY_LINE}\\n'); setInterval(function verifyOwner() { if (process.ppid !== ownerPid) throw new Error('wg-quicker operation-lock owner disappeared'); }, ${String(LOCK_PARENT_PROBE_MS,)});`;

/**
 * Acquires crash-safe kernel lock through readiness-signaled holder.
 *
 * @param lockPath - Stable advisory lock path.
 *
 * @param conflictMessage - Diagnostic when another holder owns lock.
 *
 * @returns Guard terminating holder on disposal.
 *
 * @throws {@link BypassStateError} on conflict or holder failure.
 *
 * @example
 * ```ts
 * await using lock = await claimOperationLock({ lockPath: '/run/x.lock', conflictMessage: 'busy' });
 * ```
 */
async function claimOperationLock(
  {
    lockPath,
    conflictMessage,
  }: {
    readonly lockPath: string;
    readonly conflictMessage: string;
  },
): Promise<AsyncDisposable> {
  /**
   * Primitive path snapshot passed through unresolved spawn boundary.
   */
  const pathUnits: string[] = [];
  /**
   * UTF-16 cursor preserving path exactly without sharing caller container.
   */
  const pathCursor = { index: 0, };
  while (pathCursor.index < lockPath.length) {
    pathUnits[pathCursor.index] = lockPath.charAt(pathCursor.index,);
    pathCursor.index += 1;
  }
  /**
   * Isolated path reconstructed from primitive code units.
   */
  const commandLockPath = pathUnits.join('',);
  /**
   * Lock process becoming Node after kernel lock acquisition.
   */
  const holder = spawnChild(
    'flock',
    [
      '--exclusive',
      '--nonblock',
      '--conflict-exit-code',
      String(LOCK_CONFLICT_EXIT_CODE,),
      '--no-fork',
      commandLockPath,
      process.execPath,
      '--input-type=module',
      '--eval',
      LOCK_HOLDER_SOURCE,
    ],
    {
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   * Spawn failures captured without unhandled process event.
   */
  const spawnFailureMessages: string[] = [];
  holder.once(
    'error',
    function captureSpawnFailure(error: Readonly<Error>,): void {
      spawnFailureMessages[0] = error.message;
    },
  );
  /**
   * Diagnostics consumed while readiness line is awaited.
   */
  const stderr = text(holder.stderr,);
  /**
   * Readiness lines from acquired lock holder.
   */
  const lines = createInterface({ input: holder.stdout, },);
  for await (const line of lines) {
    if (line !== LOCK_READY_LINE) {
      holder.kill('SIGKILL',);
      throw new BypassStateError(`Unexpected operation-lock readiness output: ${line}`,);
    }
    lines.close();
    return {
      async [Symbol.asyncDispose](): Promise<void> {
        if (holder.exitCode !== null)
          return;
        /**
         * Close observation registered before termination signal.
         */
        const closed = once(
          holder,
          'close',
        );
        holder.kill('SIGTERM',);
        await closed;
      },
    };
  }
  /**
   * Diagnostic after holder exits without readiness.
   */
  const diagnostic = await stderr;
  /**
   * First spawn failure when child could not start.
   */
  const [spawnFailureMessage,] = spawnFailureMessages;
  if (spawnFailureMessage !== undefined)
    throw new BypassStateError(`Cannot start operation-lock holder: ${spawnFailureMessage}`,);
  if (holder.exitCode === LOCK_CONFLICT_EXIT_CODE)
    throw new BypassStateError(conflictMessage,);
  throw new BypassStateError(
    `Operation-lock holder exited ${String(holder.exitCode,)} before readiness: ${diagnostic}`,
  );
}

/**
 * Ensures private runtime directory for advisory lock paths.
 *
 * @example
 * ```ts
 * await ensureRuntimeDirectory();
 * ```
 */
async function ensureRuntimeDirectory(): Promise<void> {
  await mkdir(
    bypassRuntimeDirectory(),
    {
      mode: 0o700,
      recursive: true,
    },
  );
}

/**
 * Acquires lock serializing one interface lifecycle.
 *
 * @param interfaceName - Interface lifecycle identity.
 *
 * @returns Crash-safe kernel-lock guard.
 *
 * @example
 * ```ts
 * await using lock = await claimBypassInterfaceOperation({ interfaceName: 'wg0' });
 * ```
 */
export async function claimBypassInterfaceOperation(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<AsyncDisposable> {
  await ensureRuntimeDirectory();
  return await claimOperationLock({
    lockPath: `${bypassRuntimeDirectory()}/interface-${bypassStateKey({ interfaceName, },)}.operation.lock`,
    conflictMessage: `Another wg-quicker lifecycle is operating on ${interfaceName}.`,
  },);
}

/**
 * Acquires global lock spanning bypass allocation and installation.
 *
 * Routes and rules become kernel-visible before guard releases,
 * so later allocators observe occupancy without persistent lock files.
 *
 * @returns Crash-safe kernel-lock guard.
 *
 * @example
 * ```ts
 * await using lock = await claimBypassAllocationOperation();
 * ```
 */
export async function claimBypassAllocationOperation(): Promise<AsyncDisposable> {
  await ensureRuntimeDirectory();
  return await claimOperationLock({
    lockPath: `${bypassRuntimeDirectory()}/allocation.operation.lock`,
    conflictMessage: 'Another wg-quicker lifecycle is allocating bypass routing resources.',
  },);
}
