#!/usr/bin/env bun

/**
 * editord entry point.
 *
 * Boot sequence:
 * 1. Generate a random auth token
 * 2. Start LSP servers (oxlint, tsgo, dprint) in the background
 * 3. Start h3 HTTP server with static file serving and WebSocket
 * 4. Print the URL with token for the user to open in Chrome
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
  LspManager,
  type WireDiagnostic,
} from './lsp/lsp-manager.ts';
import { resolveFsId, } from './operations/resolve-fs-id.ts';
import { resolveRoot, } from './operations/resolve-root.ts';
import { DirWatcher, } from './operations/watch-filesystem.ts';
import { createWsHandler, } from './ws.ts';

export {};

/** Default HTTP port when `PORT` env var is not provided. */
const DEFAULT_PORT = 4_400;

/** Radix for decimal integer parsing. */
const DECIMAL_RADIX = 10;

/**
 * Resolves the HTTP listen port from environment or default.
 *
 * @returns resolved port number
 */
function resolvePort(): number {
  const environmentPort = process.env.PORT;
  if (environmentPort === undefined)
    return DEFAULT_PORT;

  const parsedPort = Number.parseInt(
    environmentPort,
    DECIMAL_RADIX,
  );
  return Number.isNaN(parsedPort,) ? DEFAULT_PORT : parsedPort;
}

/**
 * Auth token for WebSocket connections, generated fresh each startup.
 * Passed via URL query string; acceptable for localhost-only access
 * but exposes the token in browser history and the Referer header.
 */
const AUTH_TOKEN = crypto.randomUUID();

/** Highest writable ancestor directory, used as the file tree root. */
const ROOT_DIR = await resolveRoot();

/** Stable filesystem identifier for the volume containing ROOT_DIR. */
const FS_ID = resolveFsId({ path: ROOT_DIR, },);

/** Tagged logger for the HTTP subsystem. */
const httpLog = tagged({
  tag: 'http',
  l,
},);

/** Tagged logger for the LSP subsystem. */
const lspLog = tagged({
  tag: 'lsp',
  l,
},);

//region LSP servers

/**
 * Set of connected WebSocket peers for broadcasting diagnostics.
 * Updated by the ws handler on open/close.
 */
const connectedPeers = new Set<{ send: (data: string,) => void; }>();

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
    path: string;
    diagnostics: WireDiagnostic[]
  },
): void {
  const message = JSON.stringify({
    type: 'diagnostics',
    path,
    diagnostics,
  },);
  for (const peer of connectedPeers)
    peer.send(message,);
}

/** LSP server coordinator managing oxlint, tsgo, and dprint. */
const lspManager = new LspManager({
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
const dirWatcher = new DirWatcher({
  onChange: function handleFsChange(event,): void {
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

/** h3 application instance. */
const app = new H3();

/** Base path for resolving dist and source assets relative to this file. */
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

//region WebSocket — editor communication

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

/** Running HTTP server instance. */
const _server = serve(
  app,
  {
  port: resolvePort(),
  plugins: [
    ws({
      resolve: async function resolveWebSocketHooks(request,) {
        const response = await app.fetch(request,);
        // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-explicit-any, typescript-eslint/no-unsafe-type-assertion -- crossws attaches hooks as a non-standard property on the Response object
        return (response as any).crossws;
      },
    },),
  ],
},
);

httpLog.info(`listening on http://localhost:${resolvePort()}?token=${AUTH_TOKEN}`,);
