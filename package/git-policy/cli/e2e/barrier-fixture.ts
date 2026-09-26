/**
 Hook barriers and settle windows that pin scenario interleavings.

 @module
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  type RunningProcess,
  waitForMarker,
} from './process-fixture.ts';
import type { ScenarioRepository, } from './repository-fixture.ts';

//region Barriers

/**
 Hook barrier bound for one wait.
 */
export const BARRIER_TIMEOUT_MS = 60_000;

/**
 Marker path that never exists, used to wait for settlement alone.
 */
const NEVER_MARKER = '/nonexistent/e2e-settle-window';

/**
 Arms a hook barrier so the named event blocks until released.

 @param repository - scenario repository

 @param token - attempt token

 @param event - hook event or `editor`

 @example
 ```ts
 await holdAt({ repository, token, event: 'pre-commit' });
 ```
 */
export async function holdAt({
  repository,
  token,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  event: string;
}>,): Promise<void> {
  await writeFile(
    join(
      repository.markerDir,
      `${token}.${event}.hold`,
    ),
    '',
  );
}

/**
 Releases a hook barrier.

 @param repository - scenario repository

 @param token - attempt token

 @param event - hook event or `editor`

 @example
 ```ts
 await releaseAt({ repository, token, event: 'pre-commit' });
 ```
 */
export async function releaseAt({
  repository,
  token,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  event: string;
}>,): Promise<void> {
  await writeFile(
    join(
      repository.markerDir,
      `${token}.${event}.release`,
    ),
    '',
  );
}

/**
 Waits until an attempt's hook reaches an event or the attempt settles.

 @param repository - scenario repository

 @param token - attempt token

 @param running - attempt process

 @param event - hook event or `editor`

 @returns `marker`, `settled`, or `timeout`

 @example
 ```ts
 await reached({ repository, token, running, event: 'pre-commit' });
 ```
 */
export async function reached({
  repository,
  token,
  running,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  running: Pick<RunningProcess, 'isSettled'>;
  event: string;
}>,): Promise<'marker' | 'settled' | 'timeout'> {
  return await waitForMarker({
    path: join(
      repository.markerDir,
      `${token}.${event}`,
    ),
    timeoutMs: BARRIER_TIMEOUT_MS,
    isSettled: running.isSettled,
  },);
}

/**
 Waits until a process settles or a window passes,
 whichever comes first.
 Used where the accepted design gives no hook-visible point before capture:
 a second agent captures at invocation and then waits for the hook lock,
 so the harness gives it this window before releasing the first agent.

 @param running - process to watch

 @param windowMs - longest wait

 @returns whether the process settled within the window

 @example
 ```ts
 await settleWithin({ running: second.running, windowMs: 1500 });
 ```
 */
export async function settleWithin({
  running,
  windowMs,
}: Readonly<{
  running: Pick<RunningProcess, 'isSettled'>;
  windowMs: number;
}>,): Promise<boolean> {
  return (await waitForMarker({
    path: NEVER_MARKER,
    timeoutMs: windowMs,
    isSettled: running.isSettled,
  },)) === 'settled';
}

//endregion Barriers
