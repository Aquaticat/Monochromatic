#!/usr/bin/env node

/**
 * Persistent route-change watcher for application bypass table.
 *
 * @module
 */

import { spawn as spawnChild, } from 'node:child_process';
import { once, } from 'node:events';
import { createInterface, } from 'node:readline';
import { text, } from 'node:stream/consumers';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { BypassRouteError, } from './errors.ts';
import { readBypassStatePath, } from './tunnel-bypass-state.ts';
import { registerBypassWatcher, } from './tunnel-bypass-watch-service.ts';
import { synchronizeBypassRoutes, } from './tunnel-bypass-route.ts';
import type { BypassState, } from './tunnel-bypass-types.ts';

/**
 * Module logger for watcher lifecycle.
 */
const l = tagged({ tag: 'bypass-watch', },);

/**
 * Reports whether route-monitor line can reflect main-table default change.
 *
 * Events for claimed bypass table are excluded to prevent synchronization loop.
 *
 * @param line - One `ip monitor route` line.
 *
 * @param state - Claimed table identity.
 *
 * @returns Whether watcher should resynchronize both families.
 *
 * @example
 * ```ts
 * isPhysicalDefaultEvent({ line: 'default via 192.0.2.1', state });
 * ```
 */
function isPhysicalDefaultEvent(
  {
    line,
    state,
  }: {
    readonly line: string;
    readonly state: BypassState;
  },
): boolean {
  /**
   * Trimmed event with optional deletion marker removed.
   */
  const event = line.trim()
    .startsWith('Deleted ',)
    ? line.trim()
      .slice('Deleted '.length,)
    : line.trim();
  if (!event.startsWith('default ',))
    return false;
  if (event.includes(` table ${String(state.table,)}`,))
    return false;
  /**
   * Table attribute when event explicitly names one.
   */
  const tableIndex = event.indexOf(' table ',);
  if (tableIndex === (-1))
    return true;
  return event.slice(tableIndex + ' table '.length,)
    .startsWith('main',);
}

/**
 * Watches route events and synchronizes physical defaults until terminated.
 *
 * @param state - Persisted ownership state.
 *
 * @param statePath - State path whose watcher sidecar signals readiness.
 *
 * @example
 * ```ts
 * await watchBypassRoutes({ state, statePath });
 * ```
 */
export async function watchBypassRoutes(
  {
    state,
    statePath,
  }: {
    readonly state: BypassState;
    readonly statePath: string;
  },
): Promise<void> {
  /**
   * Function-scoped logger for interface watcher.
   */
  const fl = tagged({
    tag: watchBypassRoutes.name,
    l,
  },);
  /**
   * Mutable service-stop state shared by signal and exit handling.
   */
  const stopState = { requested: false, };
  await synchronizeBypassRoutes({ state, },);
  /**
   * Route netlink monitor covering both address families.
   */
  const monitor = spawnChild(
    'ip',
    [
      'monitor',
      'route',
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
   * Terminates monitor child on service signal without aborting close-event promise.
   */
  function stopMonitoring(): void {
    fl.debug('received termination signal',);
    stopState.requested = true;
    monitor.kill('SIGTERM',);
  }
  /**
   * Logs child-process spawn failures.
   *
   * @param error - Child-process failure.
   */
  function onMonitorError(error: Readonly<Error>,): void {
    fl.error(`route monitor failed: ${error.message}`,);
  }
  monitor.on(
    'error',
    onMonitorError,
  );
  process.once(
    'SIGTERM',
    stopMonitoring,
  );
  process.once(
    'SIGINT',
    stopMonitoring,
  );
  /**
   * Close event promise registered before line iteration.
   */
  const closed = once(
    monitor,
    'close',
  );
  /**
   * Captured monitor diagnostics consumed concurrently.
   */
  const stderr = text(monitor.stderr,);
  /**
   * Line iterator over netlink event rendering.
   */
  const lines = createInterface({ input: monitor.stdout, },);
  /**
   * Process identity registration removed on clean or failed exit.
   */
  await using registration = await registerBypassWatcher({ statePath, },);
  try {
    for await (const line of lines) {
      if (!isPhysicalDefaultEvent({
        line,
        state,
      }))
        continue;
      fl.debug(`physical default changed: ${line}`,);
      await synchronizeBypassRoutes({ state, },);
    }
  }
  catch (error) {
    if (!stopState.requested) {
      fl.error(`route event loop failed: ${String(error,)}`,);
      throw error;
    }
    fl.debug(`route event loop aborted: ${String(error,)}`,);
  }
  await closed;
  /**
   * Numeric close code after monitor ends.
   */
  const { exitCode, } = monitor;
  /**
   * Captured monitor diagnostics.
   */
  const diagnostic = await stderr;
  if ((!stopState.requested) && (exitCode !== 0)) {
    throw new BypassRouteError(
      `Route monitor exited ${String(exitCode,)}: ${diagnostic}`,
    );
  }
  fl.debug('route watcher stopped',);
}

/**
 * State path supplied by systemd transient service.
 */
const [statePath,] = process.argv
  .slice(2,);
if (statePath === undefined)
  throw new BypassRouteError('Usage: bypass-watch <state-path>',);

/**
 * Validated persisted state watched by this service.
 */
const state = await readBypassStatePath({ path: statePath, },);
await watchBypassRoutes({
  state,
  statePath,
},);
