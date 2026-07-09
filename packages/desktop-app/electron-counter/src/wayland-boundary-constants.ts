/**
 * Shared constants and types for the pure-Wayland Electron boundary test.
 *
 * @example
 * ```ts
 * console.log(appDir);
 * ```
 *
 * @packageDocumentation
 */

import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

/**
 * Package directory used as task working directory.
 *
 * @example
 * ```ts
 * console.log(packageRoot);
 * ```
 */
export const packageRoot: string = process.cwd();

/**
 * Repository root derived from this two-level package path.
 *
 * @example
 * ```ts
 * console.log(repoRoot);
 * ```
 */
export const repoRoot: string = resolve(
  packageRoot,
  '..',
  '..',
  '..',
);

/**
 * Staged app directory loaded by Electron.
 *
 * @example
 * ```ts
 * console.log(appDir);
 * ```
 */
export const appDir: string = join(
  packageRoot,
  'dist',
  'app',
);

/**
 * Path to this repo's nested Wayland compositor binary.
 *
 * @example
 * ```ts
 * console.log(nestedWaylandBinary);
 * ```
 */
export const nestedWaylandBinary: string = join(
  repoRoot,
  'packages',
  'cli',
  'nested-wayland-session',
  'target',
  'release',
  'monochromatic-nested-wayland-session',
);

/**
 * Temp directory for per-run boundary-test fixtures.
 *
 * @example
 * ```ts
 * console.log(boundaryFixtureRootParent);
 * ```
 */
export const boundaryFixtureRootParent: string = tmpdir();

/**
 * Environment variable consumed by the Electron app's main process.
 *
 * @example
 * ```ts
 * console.log(statePathEnvironmentVariable);
 * ```
 */
export const statePathEnvironmentVariable = 'MONOCHROMATIC_ELECTRON_COUNTER_STATE_PATH';

/**
 * Nested test screen size.
 *
 * @example
 * ```ts
 * console.log(nestedScreenSize);
 * ```
 */
export const nestedScreenSize = '800x600';

/**
 * X coordinate hitting the rendered increment button at `800x600`.
 *
 * @example
 * ```ts
 * console.log(buttonClickX);
 * ```
 */
export const buttonClickX = 250;

/**
 * Y coordinate hitting the rendered increment button at `800x600`.
 *
 * @example
 * ```ts
 * console.log(buttonClickY);
 * ```
 */
export const buttonClickY = 425;

/**
 * Polling interval for socket and state readiness checks, in milliseconds.
 *
 * @example
 * ```ts
 * console.log(pollIntervalMs);
 * ```
 */
export const pollIntervalMs = 50;

/**
 * Deadline for compositor socket readiness, in milliseconds.
 *
 * @example
 * ```ts
 * console.log(socketReadyDeadlineMs);
 * ```
 */
export const socketReadyDeadlineMs = 10_000;

/**
 * Deadline for renderer state observation, in milliseconds.
 *
 * @example
 * ```ts
 * console.log(stateReadyDeadlineMs);
 * ```
 */
export const stateReadyDeadlineMs = 10_000;

/**
 * Deadline for hosted app shutdown after `quit`, in milliseconds.
 *
 * @example
 * ```ts
 * console.log(shutdownDeadlineMs);
 * ```
 */
export const shutdownDeadlineMs = 10_000;

/**
 * JSON state mirrored by the Electron main process during tests.
 *
 * @example
 * ```ts
 * const state: ObservedCounterState = { count: 1 };
 * ```
 */
export type ObservedCounterState = {
  readonly count: number;
};

/**
 * Runtime values allocated for a single boundary test run.
 *
 * @example
 * ```ts
 * const fixture: WaylandBoundaryFixture = {
 *   root: '/tmp/x',
 *   socketPath: '/tmp/x/nws.sock',
 *   statePath: '/tmp/x/state.json',
 * };
 * ```
 */
export type WaylandBoundaryFixture = {
  readonly root: string;
  readonly socketPath: string;
  readonly statePath: string;
};
