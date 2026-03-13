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
import { readFile, stat, } from 'node:fs/promises';
import { join, } from 'node:path';
import { H3, HTTPError, defineHandler, getRouterParam, serve, serveStatic, } from 'h3';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: opens SQLite database and runs schema migrations
import "./lib/db.ts";
import { getArgumentValue } from "./lib/args.ts";
import { handleAutofill } from "./server/api/ai-autofill.ts";
import { handleCreateTask, handleDeleteTask, handleUpdateTask } from "./server/api/tasks.ts";
import { handleCompleteTask, handleStartTimer, handleStopTimer } from "./server/api/timer.ts";
import { inProgressPage } from "./server/pages/in-progress.ts";
import { inboxPage } from "./server/pages/inbox.ts";
import { searchPage } from "./server/pages/search.ts";
import { settingsPage } from "./server/pages/settings.ts";
import { taskDetailsPage } from "./server/pages/task-details.ts";

/** Default HTTP port when neither `--port=` nor `PORT` env var is provided. */
const DEFAULT_PORT = 3_000;

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** Radix for decimal integer parsing. */
const DECIMAL_RADIX = 10;

/**
 * Resolves the HTTP listen port from CLI arguments, environment, or default.
 * Priority: `--port=N` \> `PORT` env var \> `DEFAULT_PORT`.
 *
 * @returns Resolved port number
 */
function resolvePort(): number {
  const argumentPort = getArgumentValue("port");
  const environmentPort = process.env.PORT;
  const rawPort = argumentPort ?? environmentPort;
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, DECIMAL_RADIX);
  return Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
}

/**
 * Extracts a required route parameter, throwing 400 if missing.
 *
 * @param event - h3 event
 *
 * @param name - Parameter name from the route pattern
 *
 * @returns Parameter value
 *
 * @throws {HTTPError} 400 when parameter is missing
 */
function requireParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name,);
  if (value === undefined) {
    throw new HTTPError({ status: HTTP_BAD_REQUEST, message: `missing route parameter: ${name}`, },);
  }
  return value;
}

/** h3 application instance routing HTTP requests to handlers. */
const app = new H3();

//region Page routes -- return full HTML documents (via renderPage / inline HTML)

app.get('/', defineHandler(function handleInbox() {
  return inboxPage();
}));
app.get('/in-progress', defineHandler(function handleInProgress() {
  return inProgressPage();
}));

app.get('/tasks/:id', defineHandler(function handleTaskDetails(event) {
  const id = requireParam(event, 'id',);
  return taskDetailsPage(id,);
}));

app.get('/search', defineHandler(function handleSearch(event) {
  return searchPage(event.url,);
}));
app.get('/settings', defineHandler(function handleSettings() {
  return settingsPage();
}));

//endregion Page routes

//region API routes -- return JSON

app.post('/api/tasks', defineHandler(function handleCreateTaskRoute(event) {
  return handleCreateTask(event.req,);
}));

app.put('/api/tasks/:id', defineHandler(function handleUpdateTaskRoute(event) {
  const id = requireParam(event, 'id',);
  return handleUpdateTask(event.req, id,);
}));

app.delete('/api/tasks/:id', defineHandler(function handleDeleteTaskRoute(event) {
  const id = requireParam(event, 'id',);
  return handleDeleteTask(id,);
}));

app.post('/api/tasks/:id/start', defineHandler(function handleStartTimerRoute(event) {
  const id = requireParam(event, 'id',);
  return handleStartTimer(id,);
}));

app.post('/api/tasks/:id/stop', defineHandler(function handleStopTimerRoute(event) {
  const id = requireParam(event, 'id',);
  return handleStopTimer(id,);
}));

app.post('/api/tasks/:id/complete', defineHandler(function handleCompleteTaskRoute(event) {
  const id = requireParam(event, 'id',);
  return handleCompleteTask(id,);
}));

app.post('/api/ai/autofill', defineHandler(function handleAutofillRoute(event) {
  return handleAutofill(event.req,);
}));

//endregion API routes

//region Static asset serving -- bundled JS from dist/client/

app.get('/dist/client/**', defineHandler(function handleStaticAsset(event) {
  return serveStatic(event, {
    getContents: function readContents(id) {
      return readFile(join('.', id,),);
    },
    getMeta: async function getMetadata(id) {
      const stats = await stat(join('.', id,),).catch(function onStatError() {
        return;
      },);
      if (stats === undefined || !stats.isFile()) {
        return;
      }
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
}));

//endregion Static asset serving

// Start server.
/** Running HTTP server instance listening on the configured port. */
const _server = serve(app, { port: resolvePort(), },);

console.log(`Listening on ${_server.url}`);
