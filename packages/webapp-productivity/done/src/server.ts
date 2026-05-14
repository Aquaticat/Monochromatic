/**
 * Application entry point.
 *
 * Boot sequence:
 * 1. Side-effect import of `./lib/db.ts` opens the SQLite database and runs migrations
 * 2. Start h3 HTTP server with page routes and API routes
 *
 * Client JS bundles are built separately via `mise run build:js:client` (tsdown).
 * Global CSS and component styles are generated at runtime via h-css (inlined in JS bundles).
 *
 * Request lifecycle (page):
 *   browser GET "/" -\> `inboxPage()` -\> `renderPage()` -\> HTML shell response
 *   -\> browser loads `\<script src="/dist/client/inbox.js"\>` (served by static handler)
 *   -\> client script calls `readPageData()` to hydrate from the `\<script id="page-data"\>` JSON blob
 *   -\> client script imperatively builds DOM into `\<main id="app"\>`
 *
 * Request lifecycle (API):
 *   browser fetch POST "/api/tasks/:id/complete"
 *   -\> matched by h3 router -\> handler reads/writes DB -\> JSON response
 */
import {
  defineHandler,
  getRouterParam,
  H3,
  serve,
  serveStatic,
} from 'h3';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: opens SQLite database and runs schema migrations
import './lib/db.ts';
import { getArgumentValue, } from './lib/args.ts';
import { registerApiRoutes, } from './server-api-routes.ts';
import { inProgressPage, } from './server/pages/in-progress.ts';
import { inboxPage, } from './server/pages/inbox.ts';
import { searchPage, } from './server/pages/search.ts';
import { settingsPage, } from './server/pages/settings.ts';
import { taskDetailsPage, } from './server/pages/task-details.ts';

/** Default HTTP port when neither `--port=` nor `PORT` env var is provided. */
const DEFAULT_PORT = 3_000;

/** Radix for decimal integer parsing. */
const DECIMAL_RADIX = 10;

/**
 * Resolves the HTTP listen port from CLI arguments, environment, or default.
 * Priority: `--port=N` \> `PORT` env var \> `DEFAULT_PORT`.
 *
 * @returns Resolved port number
 */
function resolvePort(): number {
  /** Highest-priority source: explicit `--port=` flag. */
  const argumentPort = getArgumentValue('port',);
  /** Mid-priority source: `PORT` env var when no flag is given. */
  const environmentPort = process.env.PORT;
  /** First-found source; `undefined` falls through to the default port. */
  const rawPort = argumentPort ?? environmentPort;
  if (rawPort === undefined)
    return DEFAULT_PORT;

  /** Numeric parse with `NaN` falling back to the default. */
  const parsedPort = Number.parseInt(
    rawPort,
    DECIMAL_RADIX,
  );
  return Number.isNaN(parsedPort,) ? DEFAULT_PORT : parsedPort;
}

/** h3 application instance routing HTTP requests to handlers. */
const app = new H3();

//region Page routes: return full HTML documents (via renderPage / inline HTML)

app.get(
  '/',
  defineHandler(function handleInbox() {
    return inboxPage();
  },),
);
app.get(
  '/in-progress',
  defineHandler(function handleInProgress() {
    return inProgressPage();
  },),
);

app.get(
  '/tasks/:id',
  defineHandler(function handleTaskDetails(event,) {
    /** Route slug captured from `/tasks/:id`; undefined is a router invariant violation. */
    const id = getRouterParam(
      event,
      'id',
    );
    if (id === undefined)
      throw new Error('missing route parameter: id',);
    return taskDetailsPage(id,);
  },),
);

app.get(
  '/search',
  defineHandler(function handleSearch(event,) {
    return searchPage(event.url,);
  },),
);
app.get(
  '/settings',
  defineHandler(function handleSettings() {
    return settingsPage();
  },),
);

//endregion Page routes

//region API routes: return JSON

registerApiRoutes(app,);

//endregion API routes

//region Static asset serving: bundled JS from dist/client/

app.get(
  '/dist/client/**',
  defineHandler(function handleStaticAsset(event,) {
    return serveStatic(
      event,
      {
        getContents: function readContents(id,) {
          return readFile(
            join(
              '.',
              id,
            ),
          );
        },
        getMeta: async function getMetadata(id,) {
          /** Reassigned in the try block; remains undefined when the file is missing. */
          let stats: Awaited<ReturnType<typeof stat>> | undefined = undefined;
          try {
            stats = await stat(
              join(
                '.',
                id,
              ),
            );
          }
          catch {
            return;
          }
          if (!stats.isFile())
            return;
          return {
            size: stats.size,
            mtime: stats.mtimeMs,
          };
        },
      },
    );
  },),
);

//endregion Static asset serving

// Start server.
/** Running HTTP server instance listening on the configured port. */
const _server = serve(
  app,
  { port: resolvePort(), },
);

console.log(`Listening on ${_server.url}`,);
