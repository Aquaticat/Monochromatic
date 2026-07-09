/**
 * End-user boundary test for the Electron counter under pure Wayland.
 *
 * The test hosts Electron inside this repo's nested Wayland compositor,
 * launches the app with `DISPLAY` unset, clicks the rendered button through the
 * compositor control socket, and waits for the main process to mirror renderer
 * state into a JSON file.
 *
 * @example
 * ```ts
 * await runWaylandBoundaryTest();
 * ```
 */

import { join, } from 'node:path';

import {
  appDir,
  buttonClickX,
  buttonClickY,
  nestedWaylandBinary,
  socketReadyDeadlineMs,
} from './wayland-boundary-constants.js';
import {
  assertPathAccessible,
  expectOkControlCommand,
  waitForPath,
} from './wayland-boundary-control.js';
import {
  createFixture,
  spawnNestedWaylandSession,
  waitForSuccessfulExit,
} from './wayland-boundary-process.js';
import { waitForObservedCount, } from './wayland-boundary-state.js';

/**
 * Asserts that this host can run the pure-Wayland boundary test.
 *
 * @example
 * ```ts
 * assertLinuxWaylandHost();
 * ```
 */
function assertLinuxWaylandHost(): void {
  if (process.platform !== 'linux')
    throw new Error('Pure Wayland boundary test only runs on Linux.',);

  if (process.env
    .WAYLAND_DISPLAY
    === undefined)
    throw new Error('Pure Wayland boundary test requires a parent Wayland session.',);
}

/**
 * Clicks the counter button and waits for the renderer state update.
 *
 * @param socketPath - Nested compositor control socket path.
 *
 * @param statePath - State file written by Electron main process.
 *
 * @example
 * ```ts
 * await clickCounterAndWait({ socketPath: '/tmp/nws.sock', statePath: '/tmp/state.json' });
 * ```
 */
async function clickCounterAndWait(
  {
    socketPath,
    statePath,
  }: {
    readonly socketPath: string;
    readonly statePath: string;
  },
): Promise<void> {
  await expectOkControlCommand({
    socketPath,
    command: `click ${buttonClickX} ${buttonClickY} left`,
  },);
  await waitForObservedCount({
    statePath,
    expectedCount: 1,
  },);
}

/**
 * Captures a screenshot after the counter interaction.
 *
 * @param root - Boundary-test fixture root directory.
 *
 * @param socketPath - Nested compositor control socket path.
 *
 * @example
 * ```ts
 * await captureAfterClickScreenshot({ root: '/tmp/run', socketPath: '/tmp/nws.sock' });
 * ```
 */
async function captureAfterClickScreenshot(
  {
    root,
    socketPath,
  }: {
    readonly root: string;
    readonly socketPath: string;
  },
): Promise<void> {
  await expectOkControlCommand({
    socketPath,
    command: `screenshot ${join(
      root,
      'after-click.png',
    )}`,
  },);
}

/**
 * Runs the complete pure-Wayland interaction test.
 *
 * @example
 * ```ts
 * await runWaylandBoundaryTest();
 * ```
 */
async function runWaylandBoundaryTest(): Promise<void> {
  assertLinuxWaylandHost();

  await assertPathAccessible({
    path: appDir,
    label: 'staged Electron app',
  },);
  await assertPathAccessible({
    path: nestedWaylandBinary,
    label: 'nested Wayland compositor binary',
  },);

  /**
   * Temp fixture shared by nested compositor and control client.
   */
  await using fixture = await createFixture();

  /**
   * Nested compositor process hosting Electron.
   */
  const child = spawnNestedWaylandSession({ fixture, },);

  try {
    await waitForPath({
      path: fixture.socketPath,
      deadlineMs: socketReadyDeadlineMs,
    },);
    await expectOkControlCommand({
      socketPath: fixture.socketPath,
      command: 'ping',
    },);
    await waitForObservedCount({
      statePath: fixture.statePath,
      expectedCount: 0,
    },);
    await clickCounterAndWait({
      socketPath: fixture.socketPath,
      statePath: fixture.statePath,
    },);
    await captureAfterClickScreenshot({
      root: fixture.root,
      socketPath: fixture.socketPath,
    },);
    await expectOkControlCommand({
      socketPath: fixture.socketPath,
      command: 'quit',
    },);
  }
  catch (error: unknown) {
    child.kill('SIGTERM',);
    throw error;
  }

  await waitForSuccessfulExit({ child, },);
}

await runWaylandBoundaryTest();
