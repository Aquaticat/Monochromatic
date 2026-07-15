#!/usr/bin/env node

/**
 * editord entry point.
 *
 * Boot sequence:
 * 1. Resolve auth token (reuse from previous instance on auto-restart, or generate fresh)
 * 2. Start LSP servers (oxlint, tsc, dprint) in the background
 * 3. Start h3 HTTP server with static file serving and WebSocket
 * 4. Print the URL with token for the user to open in Chrome
 * 5. Register SIGINT/SIGTERM handlers for graceful shutdown
 *
 * @example
 * ```sh
 * bun src/server/index.ts
 * # Open the printed URL in Chrome with --app flag for PWA-like experience
 * ```
 */

import { plugin as ws, } from 'crossws/server';
import {
  H3,
  serve,
} from 'h3';
import { join, } from 'node:path';

import { registerRoutes, } from './index-routes.ts';
import {
  l,
  tagged,
} from './log.ts';
import {
  createLspManager,
  type WireDiagnostic,
} from './lsp/lsp-manager.ts';
import { resolveFsId, } from './operations/resolve-fs-id.ts';
import { resolveRoot, } from './operations/resolve-root.ts';
import { resolveAuthToken, } from './operations/token-file.ts';
import { createDirWatcher, } from './operations/watch-filesystem.ts';
import { createWsHandler, } from './ws.ts';

export {};

/**
 * Default HTTP port when `PORT` env var is not provided.
 */
const DEFAULT_PORT = 4_400;

/**
 * Radix for decimal integer parsing.
 */
const DECIMAL_RADIX = 10;

/**
 * Resolves the HTTP listen port from environment or default.
 *
 * @returns resolved port number
 */
function resolvePort(): number {
  /**
   * Raw env value (undefined when unset) gates the parse below.
   */
  const environmentPort = process.env
    .PORT;
  if (environmentPort === undefined)
    return DEFAULT_PORT;

  /**
   * Decimal-radix parse; NaN falls through to the default.
   */
  const parsedPort = Number.parseInt(
    environmentPort,
    DECIMAL_RADIX,
  );
  return Number.isNaN(parsedPort,) ? DEFAULT_PORT : parsedPort;
}

/**
 * Resolved HTTP listen port.
 */
const PORT = resolvePort();

/**
 * Auth token for WebSocket connections.
 * Uses `EDITORD_TOKEN` env var if set, otherwise reused across
 * dev-mode auto-restarts (token file mtime within 3s).
 * On cold starts, a fresh UUID is generated.
 */
const {
  token: AUTH_TOKEN,
  stopTouching: stopTokenTouch,
  deleteFile: deleteTokenFile,
} = await resolveAuthToken({
  port: PORT,
  l,
},);

/**
 * Highest writable ancestor directory, used as the file tree root.
 */
const ROOT_DIR = await resolveRoot();

/**
 * Stable filesystem identifier for the volume containing ROOT_DIR.
 */
const FS_ID = resolveFsId({ path: ROOT_DIR, },);

/**
 * Tagged logger for the HTTP subsystem.
 */
const httpLog = tagged({
  tag: 'http',
  l,
},);

/**
 * Tagged logger for the LSP subsystem.
 */
const lspLog = tagged({
  tag: 'lsp',
  l,
},);

//region LSP servers

/**
 * Set of connected WebSocket peers for broadcasting diagnostics.
 * Updated by the ws handler on open/close.
 */
const connectedPeers = new Set<{ readonly send: (data: string,) => void; }>();

/**
 * Pushes diagnostics from LSP servers to all connected WebSocket peers.
 *
 * @param path - absolute file path the diagnostics apply to
 *
 * @param diagnostics - merged diagnostics from all LSP sources
 */
function handleDiagnostics(
  {
    path,
    diagnostics,
  }: {
    readonly path: string;
    readonly diagnostics: readonly WireDiagnostic[];
  },
): void {
  if (connectedPeers.size
    === 0)
    return;
  /**
   * Stringified once and reused across all peers in the broadcast loop.
   */
  const message = JSON.stringify({
    type: 'diagnostics',
    path,
    diagnostics,
  },);
  for (const peer of connectedPeers)
    peer.send(message,);
}

/**
 * LSP server coordinator managing oxlint, tsc, and dprint.
 */
const lspManager = createLspManager({
  ceiling: ROOT_DIR,
  onDiagnostics: handleDiagnostics,
  l: lspLog,
},);

//endregion LSP servers

//region Filesystem watcher

/**
 * Broadcasts filesystem change events to all connected WebSocket peers.
 * Watches directories on demand as the client expands them in the tree.
 */
const dirWatcher = createDirWatcher({
  onChange: function handleFsChange(event,): void {
    if (connectedPeers.size
      === 0)
      return;
    /**
     * Stringified once and reused across all peers in the broadcast loop.
     */
    const message = JSON.stringify({
      type: 'fileChanged',
      path: event.path,
      changeType: event.changeType,
      isDirectory: event.isDirectory,
    },);
    for (const peer of connectedPeers)
      peer.send(message,);
  },
  l,
},);

//endregion Filesystem watcher

/**
 * h3 application instance.
 */
const app = new H3();

/**
 * Base path for resolving dist and source assets relative to this file.
 */
const packageRoot = join(
  import.meta.dirname,
  '../..',
);

registerRoutes({
  app,
  packageRoot,
  authToken: AUTH_TOKEN,
  rootDir: ROOT_DIR,
},);

//region WebSocket: editor communication

app.get(
  '/_ws',
  createWsHandler({
    authToken: AUTH_TOKEN,
    rootDir: ROOT_DIR,
    fsId: FS_ID,
    lspManager,
    connectedPeers,
    dirWatcher,
  },),
);

//endregion WebSocket

/**
 * Running HTTP server instance; closed on SIGINT/SIGTERM by our handler.
 */
const server = serve(
  app,
  {
    port: PORT,
    /**
     * Disable srvx's built-in SIGINT/SIGTERM handler so our async cleanup runs first without racing it.
     */
    gracefulShutdown: false,
    plugins: [
      ws({
        resolve: async function resolveWebSocketHooks(request,) {
          /**
           * h3 response carrying crossws hooks as a non-standard property.
           */
          const response = await app.fetch(request,);
          // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-explicit-any, typescript-eslint/no-unsafe-type-assertion -- crossws attaches hooks as a non-standard property on the Response object
          return (response as any).crossws;
        },
      },),
    ],
  },
);

httpLog.info(`listening on http://localhost:${String(PORT,)}?token=${AUTH_TOKEN}`,);

//region Graceful shutdown

/**
 * Seconds to wait for cleanup before assuming an LSP child has hung the event loop.
 */
const SHUTDOWN_WATCHDOG_SECONDS = 5;

/**
 * Milliseconds per second for watchdog timeout computation.
 */
const SHUTDOWN_MS_PER_SECOND = 1_000;

/**
 * Performs the application-specific shutdown sequence: stops timers,
 * releases filesystem watchers, awaits LSP child termination, and closes
 * the HTTP/WebSocket server. Once all of these resolve, the event loop
 * has no remaining ref'd handles and the process exits naturally.
 *
 * @param deleteTokens - whether to delete the auth token file (true for SIGINT, false for SIGTERM auto-restart)
 */
async function shutdownApp(
  { deleteTokens, }: { readonly deleteTokens: boolean; },
): Promise<void> {
  stopTokenTouch();
  if (deleteTokens)
    deleteTokenFile();
  await dirWatcher.close();
  await lspManager.shutdown();
  await server.close(true,);
}

/**
 * Starts a watchdog that force-exits if cleanup hasn't drained the event
 * loop within SHUTDOWN_WATCHDOG_SECONDS. LSP child stdio pipes occasionally
 * remain ref'd after `client.shutdown()` returns; this is the backstop.
 *
 * The thrown error propagates to Node's default `uncaughtException` handler,
 * which prints the stack to stderr and exits the process with code 1.
 */
function startShutdownWatchdog(): void {
  /**
   * Unref'd timer so it does not by itself keep the event loop alive.
   */
  const watchdog = setTimeout(
    function shutdownWatchdogTimeout(): void {
      throw new Error(
        `shutdown timed out after ${String(SHUTDOWN_WATCHDOG_SECONDS,)}s, forcing exit`,
      );
    },
    SHUTDOWN_WATCHDOG_SECONDS * SHUTDOWN_MS_PER_SECOND,
  );
  watchdog.unref();
}

/**
 * Logs and surfaces a non-zero exit code when the async shutdown chain rejects.
 *
 * @param error - the rejection value from the shutdown promise
 */
function logShutdownError(error: unknown,): void {
  httpLog.error(`shutdown failed: ${String(error,)}`,);
  process.exitCode = 1;
}

process.on(
  'SIGINT',
  function onSigint(): void {
    startShutdownWatchdog();
    void (async function performSigintShutdown(): Promise<void> {
      try {
        await shutdownApp({ deleteTokens: true, },);
      }
      catch (error) {
        logShutdownError(error,);
      }
    })();
  },
);
process.on(
  'SIGTERM',
  function onSigterm(): void {
    startShutdownWatchdog();
    void (async function performSigtermShutdown(): Promise<void> {
      try {
        await shutdownApp({ deleteTokens: false, },);
      }
      catch (error) {
        logShutdownError(error,);
      }
    })();
  },
);

//endregion Graceful shutdown
