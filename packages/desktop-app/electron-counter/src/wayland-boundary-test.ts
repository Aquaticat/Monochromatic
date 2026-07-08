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

import { once, } from 'node:events';
import {
  access,
  mkdtemp,
  readFile,
} from 'node:fs/promises';
import { existsSync, } from 'node:fs';
import { createRequire, } from 'node:module';
import { tmpdir, } from 'node:os';
import { join, resolve, } from 'node:path';
import { spawn, type ChildProcess, } from 'node:child_process';
import { createConnection, } from 'node:net';
import { setTimeout as wait, } from 'node:timers/promises';

/** CommonJS require rooted at this tool so the Electron binary path can be read. */
const require = createRequire(import.meta.url,);

/** Package directory used as task working directory. */
const packageRoot = process.cwd();

/** Repository root derived from this two-level package path. */
const repoRoot = resolve(packageRoot, '..', '..', '..',);

/** Staged app directory loaded by Electron. */
const appDir = join(packageRoot, 'dist', 'app',);

/** Path to this repo's nested Wayland compositor binary. */
const nestedWaylandBinary = join(
  repoRoot,
  'packages',
  'cli',
  'nested-wayland-session',
  'target',
  'release',
  'monochromatic-nested-wayland-session',
);

/** Environment variable consumed by the Electron app's main process. */
const statePathEnvironmentVariable = 'MONOCHROMATIC_ELECTRON_COUNTER_STATE_PATH';

/** Nested test screen size. */
const nestedScreenSize = '800x600';

/** X coordinate hitting the rendered increment button at `800x600`. */
const buttonClickX = 250;

/** Y coordinate hitting the rendered increment button at `800x600`. */
const buttonClickY = 425;

/** Polling interval for socket and state readiness checks, in milliseconds. */
const pollIntervalMs = 50;

/** Deadline for compositor socket readiness, in milliseconds. */
const socketReadyDeadlineMs = 10_000;

/** Deadline for renderer state observation, in milliseconds. */
const stateReadyDeadlineMs = 10_000;

/** Deadline for hosted app shutdown after `quit`, in milliseconds. */
const shutdownDeadlineMs = 10_000;

/**
 * JSON state mirrored by the Electron main process during tests.
 *
 * @example
 * ```ts
 * const state: ObservedCounterState = { count: 1 };
 * ```
 */
type ObservedCounterState = {
  readonly count: number;
};

/**
 * Runtime values allocated for a single boundary test run.
 *
 * @example
 * ```ts
 * const fixture: WaylandBoundaryFixture = { root: '/tmp/x', socketPath: '/tmp/x/nws.sock', statePath: '/tmp/x/state.json' };
 * ```
 */
type WaylandBoundaryFixture = {
  readonly root: string;
  readonly socketPath: string;
  readonly statePath: string;
};

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
  if (typeof value !== 'string')
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
 * Asserts that a required executable or directory exists before spawning.
 *
 * @param path - Filesystem path that must exist.
 *
 * @param label - Human-readable name for error messages.
 *
 * @throws Error when path is absent.
 *
 * @example
 * ```ts
 * assertPathExists({ path: appDir, label: 'staged app' });
 * ```
 */
function assertPathExists(
  {
    path,
    label,
  }: {
    readonly label: string;
    readonly path: string;
  },
): void {
  if (!existsSync(path,))
    throw new Error(`${label} does not exist at ${path}`,
    );
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
async function createFixture(): Promise<WaylandBoundaryFixture> {
  /** Temporary root directory for this test run. */
  const root = await mkdtemp(join(tmpdir(), 'electron-counter-wayland-',),);

  return {
    root,
    socketPath: join(root, 'control.sock',),
    statePath: join(root, 'state.json',),
  };
}

/**
 * Waits until a filesystem path exists.
 *
 * @param deadlineMs - Maximum wait before failing.
 *
 * @param path - Path expected to appear.
 *
 * @example
 * ```ts
 * await waitForPath({ path: '/tmp/socket', deadlineMs: 1000 });
 * ```
 */
async function waitForPath(
  {
    deadlineMs,
    path,
  }: {
    readonly deadlineMs: number;
    readonly path: string;
  },
): Promise<void> {
  /** Absolute timestamp when waiting must fail. */
  const deadline = Date.now() + deadlineMs;

  while (Date.now() < deadline) {
    try {
      await access(path,);
      return;
    }
    catch (error: unknown) {
      await wait(pollIntervalMs,);
    }
  }

  throw new Error(`Timed out waiting for ${path}`,
  );
}

/**
 * Sends one command to the nested compositor control socket.
 *
 * @param command - Newline-free control protocol command.
 *
 * @param socketPath - Unix socket exposed by nested Wayland session.
 *
 * @returns Single response line from the compositor.
 *
 * @example
 * ```ts
 * await sendControlCommand({ socketPath: '/tmp/nws.sock', command: 'ping' });
 * ```
 */
async function sendControlCommand(
  {
    command,
    socketPath,
  }: {
    readonly command: string;
    readonly socketPath: string;
  },
): Promise<string> {
  /** Connected Unix socket client for one control command. */
  const client = createConnection(socketPath,);
  client.setEncoding('utf8',);
  await once(client, 'connect',);
  client.write(`${command}\n`,);
  /** First response chunk from the line-oriented control protocol. */
  const response = await once(client, 'data',) as [string];
  client.end();
  return response[0].trim();
}

/**
 * Sends a control command and requires an `ok` response.
 *
 * @param command - Control protocol command.
 *
 * @param socketPath - Unix socket exposed by nested Wayland session.
 *
 * @example
 * ```ts
 * await expectOkControlCommand({ socketPath: '/tmp/nws.sock', command: 'ping' });
 * ```
 */
async function expectOkControlCommand(
  {
    command,
    socketPath,
  }: {
    readonly command: string;
    readonly socketPath: string;
  },
): Promise<void> {
  /** Response returned by the compositor. */
  const response = await sendControlCommand({ command, socketPath, },);

  if (!response.startsWith('ok',))
    throw new Error(`Control command failed: ${command}: ${response}`,
    );
}

/**
 * Parses the observed state JSON written by the Electron main process.
 *
 * @param value - Parsed JSON value.
 *
 * @returns Observed counter state.
 *
 * @throws Error when JSON shape is unexpected.
 *
 * @example
 * ```ts
 * parseObservedCounterState({ value: { count: 1 } });
 * ```
 */
function parseObservedCounterState({ value, }: { readonly value: unknown; },): ObservedCounterState {
  if (
    typeof value !== 'object'
    || value === null
    || !('count' in value)
  )
    throw new Error('Observed counter state did not contain a count.',);

  /** State after structural narrowing. */
  const state = value as { readonly count: unknown; };

  if (typeof state.count !== 'number')
    throw new Error('Observed counter count must be numeric.',);

  return { count: state.count, };
}

/**
 * Reads the observed state file if it exists.
 *
 * @param statePath - State file path written by Electron main process.
 *
 * @returns Parsed observed state, or `undefined` when file is not present yet.
 *
 * @example
 * ```ts
 * await readObservedState({ statePath: '/tmp/state.json' });
 * ```
 */
async function readObservedState(
  { statePath, }: { readonly statePath: string; },
): Promise<ObservedCounterState | undefined> {
  if (!existsSync(statePath,))
    return undefined;

  /** Raw state JSON emitted by Electron main process. */
  const stateText = await readFile(statePath, 'utf8',);
  return parseObservedCounterState({ value: JSON.parse(stateText,), },);
}

/**
 * Waits until the observed counter state reaches an expected value.
 *
 * @param expectedCount - Expected counter value.
 *
 * @param statePath - State file path written by Electron main process.
 *
 * @example
 * ```ts
 * await waitForObservedCount({ statePath: '/tmp/state.json', expectedCount: 1 });
 * ```
 */
async function waitForObservedCount(
  {
    expectedCount,
    statePath,
  }: {
    readonly expectedCount: number;
    readonly statePath: string;
  },
): Promise<void> {
  /** Absolute timestamp when state waiting must fail. */
  const deadline = Date.now() + stateReadyDeadlineMs;

  while (Date.now() < deadline) {
    /** Current observed state, if Electron has written one. */
    const state = await readObservedState({ statePath, },);

    if (state?.count === expectedCount)
      return;

    await wait(pollIntervalMs,);
  }

  throw new Error(`Timed out waiting for counter state ${expectedCount}`,
  );
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
function spawnNestedWaylandSession(
  { fixture, }: { readonly fixture: WaylandBoundaryFixture; },
): ChildProcess {
  /** Electron executable provided by the installed Electron package. */
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
 * Waits for a child process to exit successfully.
 *
 * @param child - Process to observe.
 *
 * @example
 * ```ts
 * await waitForSuccessfulExit({ child });
 * ```
 */
async function waitForSuccessfulExit({ child, }: { readonly child: ChildProcess; },): Promise<void> {
  /** Timeout that terminates the child if quit does not complete. */
  const timeout = setTimeout(function killHungChild(): void {
    child.kill('SIGTERM',);
  }, shutdownDeadlineMs,);

  /** Exit event payload from the child process. */
  const exit = await once(child, 'exit',) as [number | null, NodeJS.Signals | null];
  clearTimeout(timeout,);

  if (exit[0] !== 0)
    throw new Error(`Nested Wayland session exited with code ${String(exit[0],)} signal ${String(exit[1],)}`,
    );
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
  if (process.platform !== 'linux')
    throw new Error('Pure Wayland boundary test only runs on Linux.',);

  if (process.env.WAYLAND_DISPLAY === undefined)
    throw new Error('Pure Wayland boundary test requires a parent Wayland session.',);

  assertPathExists({ path: appDir, label: 'staged Electron app', },);
  assertPathExists({ path: nestedWaylandBinary, label: 'nested Wayland compositor binary', },);

  /** Temp fixture shared by nested compositor and control client. */
  const fixture = await createFixture();

  /** Nested compositor process hosting Electron. */
  const child = spawnNestedWaylandSession({ fixture, },);

  try {
    await waitForPath({ path: fixture.socketPath, deadlineMs: socketReadyDeadlineMs, },);
    await expectOkControlCommand({ socketPath: fixture.socketPath, command: 'ping', },);
    await waitForObservedCount({ statePath: fixture.statePath, expectedCount: 0, },);
    await expectOkControlCommand({
      socketPath: fixture.socketPath,
      command: `click ${buttonClickX} ${buttonClickY} left`,
    },);
    await waitForObservedCount({ statePath: fixture.statePath, expectedCount: 1, },);
    await expectOkControlCommand({
      socketPath: fixture.socketPath,
      command: `screenshot ${join(fixture.root, 'after-click.png',)}`,
    },);
    await expectOkControlCommand({ socketPath: fixture.socketPath, command: 'quit', },);
  }
  catch (error: unknown) {
    child.kill('SIGTERM',);
    throw error;
  }

  await waitForSuccessfulExit({ child, },);
}

await runWaylandBoundaryTest();
