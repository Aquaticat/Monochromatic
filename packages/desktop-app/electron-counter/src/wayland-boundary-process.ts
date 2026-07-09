/**
 * Process helpers for the pure-Wayland Electron boundary test.
 *
 * @example
 * ```ts
 * const fixture = await createFixture();
 * ```
 *
 * @packageDocumentation
 */

import { once, } from 'node:events';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { createRequire, } from 'node:module';
import { join, } from 'node:path';
import {
  spawn,
  type ChildProcess,
} from 'node:child_process';

import {
  appDir,
  boundaryFixtureRootParent,
  nestedScreenSize,
  nestedWaylandBinary,
  shutdownDeadlineMs,
  statePathEnvironmentVariable,
  type WaylandBoundaryFixture,
} from './wayland-boundary-constants.js';

/**
 * CommonJS require rooted at this tool so the Electron binary path can be read.
 *
 * @example
 * ```ts
 * console.log(typeof require);
 * ```
 */
const require = createRequire(import.meta.url,);

/**
 * Parses the value exported by the `electron` launcher package.
 *
 * @param value - Unknown value returned by `require('electron')`.
 *
 * @returns Absolute Electron executable path.
 *
 * @throws Error when the package did not return a string path.
 *
 * @example
 * ```ts
 * parseElectronBinaryPath({ value: '/path/to/electron' });
 * ```
 */
function parseElectronBinaryPath({ value, }: { readonly value: unknown; },): string {
  if ((typeof value) !== 'string')
    throw new Error('The electron package did not resolve to a binary path.',);

  return value;
}

/**
 * Returns the installed Electron binary path.
 *
 * @returns Electron executable path from the launcher package.
 *
 * @example
 * ```ts
 * const electron = electronBinaryPath();
 * ```
 */
function electronBinaryPath(): string {
  return parseElectronBinaryPath({ value: require('electron',) as unknown, },);
}

/**
 * Creates temp paths for socket, state file, and screenshot output.
 *
 * @returns Boundary-test temp fixture paths.
 *
 * @example
 * ```ts
 * const fixture = await createFixture();
 * ```
 */
export async function createFixture(): Promise<WaylandBoundaryFixture> {
  /**
   * Temporary root directory for this test run.
   */
  const root = await mkdtemp(
    join(
      boundaryFixtureRootParent,
      'electron-counter-wayland-',
    ),
  );

  return {
    root,
    socketPath: join(
      root,
      'control.sock',
    ),
    statePath: join(
      root,
      'state.json',
    ),
    [Symbol.asyncDispose]: async function removeFixture(): Promise<void> {
      await rm(
        root,
        {
          force: true,
          recursive: true,
        },
      );
    },
  };
}

/**
 * Spawns nested Wayland session hosting the Electron counter app.
 *
 * @param fixture - Temp paths shared with the control client.
 *
 * @returns Spawned nested compositor process.
 *
 * @example
 * ```ts
 * const child = spawnNestedWaylandSession({ fixture: await createFixture() });
 * ```
 */
export function spawnNestedWaylandSession(
  { fixture, }: { readonly fixture: WaylandBoundaryFixture; },
): ChildProcess {
  /**
   * Electron executable provided by the installed Electron package.
   */
  const electron = electronBinaryPath();

  return spawn(
    nestedWaylandBinary,
    [
      '--socket',
      fixture.socketPath,
      '--size',
      nestedScreenSize,
      '--',
      '/usr/bin/env',
      '--unset=DISPLAY',
      'XDG_SESSION_TYPE=wayland',
      `${statePathEnvironmentVariable}=${fixture.statePath}`,
      electron,
      appDir,
    ],
    {
      env: {
        ...process.env,
        XDG_SESSION_TYPE: 'wayland',
      },
      stdio: 'inherit',
    },
  );
}

/**
 * Formats a Node child-process exit event payload for diagnostics.
 *
 * @param code - Raw exit code payload.
 *
 * @param signal - Raw exit signal payload.
 *
 * @returns Human-readable exit status.
 *
 * @example
 * ```ts
 * formatExitStatus({ code: 0, signal: 'SIGTERM' });
 * ```
 */
function formatExitStatus(
  {
    code,
    signal,
  }: {
    readonly code: unknown;
    readonly signal: unknown;
  },
): string {
  return `code ${String(code,)} signal ${String(signal,)}`;
}

/**
 * Checks whether a value is an indexable unknown array.
 *
 * @param value - Value to check.
 *
 * @returns Whether value is an array of unknown entries.
 *
 * @example
 * ```ts
 * isReadonlyUnknownArray([0]);
 * ```
 */
function isReadonlyUnknownArray(value: unknown,): value is readonly unknown[] {
  return Array.isArray(value,);
}

/**
 * Parses Node's child-process `exit` event payload.
 *
 * @param value - Raw payload returned by `events.once`.
 *
 * @returns Raw exit status values.
 *
 * @throws Error when event payload is unexpectedly shaped.
 *
 * @example
 * ```ts
 * parseExitEvent({ value: [0, undefined] });
 * ```
 */
function parseExitEvent(
  { value, }: { readonly value: unknown; },
): {
  readonly code: unknown;
  readonly signal: unknown
} {
  if (!isReadonlyUnknownArray(value,))
    throw new Error('Child-process exit event payload was not an array.',);

  /**
   * Raw exit code and signal payloads from Node's `exit` event.
   */
  const [code, signal,] = value;

  return {
    code,
    signal,
  };
}

/**
 * Waits for a child process to exit successfully.
 *
 * @param child - Process to observe.
 *
 * @example
 * ```ts
 * await waitForSuccessfulExit({ child });
 * ```
 */
export async function waitForSuccessfulExit(
  { child, }: { readonly child: ChildProcess; },
): Promise<void> {
  /**
   * Timeout that terminates the child if quit does not complete.
   */
  const timeout = setTimeout(
    function killHungChild(): void {
      child.kill('SIGTERM',);
    },
    shutdownDeadlineMs,
  );

  /**
   * Raw exit event payload from the child process.
   */
  const exit = await once(
    child,
    'exit',
  );
  clearTimeout(timeout,);

  /**
   * Parsed exit status values.
   */
  const {
    code,
    signal,
  } = parseExitEvent({ value: exit, },);

  if (code !== 0)
    throw new Error(`Nested Wayland session exited with ${formatExitStatus({
      code,
      signal,
    },)}`,
    );
}
