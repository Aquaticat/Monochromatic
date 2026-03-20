#!/usr/bin/env bun
/**
 * editord entry point.
 *
 * Boot sequence:
 * 1. Generate a random auth token
 * 2. Start h3 HTTP server with static file serving and WebSocket
 * 3. Print the URL with token for the user to open in Chrome
 *
 * @example
 * ```sh
 * bun src/server/index.ts
 * # Open the printed URL in Chrome with --app flag for PWA-like experience
 * ```
 */

import {
  H3,
  defineHandler,
  serve,
  serveStatic,
} from 'h3';
import { readFile, stat, } from 'node:fs/promises';
import { join, } from 'node:path';
import { plugin as ws, } from 'crossws/server';

import { l, tagged, } from './log.ts';
import { resolveRoot, } from './operations/resolve-root.ts';
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

  const parsedPort = Number.parseInt(environmentPort, DECIMAL_RADIX,);
  return Number.isNaN(parsedPort,) ? DEFAULT_PORT : parsedPort;
}

/** Auth token for WebSocket connections, generated fresh each startup. */
const AUTH_TOKEN = crypto.randomUUID();

/** Highest writable ancestor directory, used as the file tree root. */
const ROOT_DIR = await resolveRoot();

/** Tagged logger for the HTTP subsystem. */
const httpLog = tagged({ tag: 'http', l, },);

/** h3 application instance. */
const app = new H3();

/** Base path for resolving dist and source assets relative to this file. */
const packageRoot = join(import.meta.dirname, '../..',);

//region Static file serving — built client bundles from dist/client/

app.get('/', defineHandler(async function handleIndex() {
  const html = await readFile(join(packageRoot, 'src/client/index.html',), 'utf8',);
  return new Response(
    html,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', }, },
  );
},),);

app.get('/dist/client/**', defineHandler(function handleStaticAsset(event,) {
  return serveStatic(event, {
    getContents: function readContents(id,) {
      return readFile(join(packageRoot, id,),);
    },
    getMeta: async function getMetadata(id,) {
      const fullPath = join(packageRoot, id,);
      let stats: Awaited<ReturnType<typeof stat>> | undefined = undefined;
      try {
        stats = await stat(fullPath,);
      }
      catch (error) {
        /** Only swallow ENOENT (file not found); rethrow unexpected errors. */
        const isNotFound = error instanceof Error
          && 'code' in error
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- guarded by instanceof Error and 'code' in error above
          && (error as NodeJS.ErrnoException).code === 'ENOENT';
        if (!isNotFound)
          throw error;

        return;
      }
      if (!stats.isFile())
        return;
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
},),);

//endregion Static file serving

//region WebSocket — editor communication

app.get('/_ws', createWsHandler({ authToken: AUTH_TOKEN, rootDir: ROOT_DIR, },),);

//endregion WebSocket

/** Running HTTP server instance. */
const _server = serve(app, {
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
},);

httpLog.info(`listening on http://localhost:${resolvePort()}?token=${AUTH_TOKEN}`,);
