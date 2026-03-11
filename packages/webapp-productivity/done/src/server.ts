/**
 * Application entry point.
 *
 * Boot sequence:
 * 1. Side-effect import of `./lib/db.ts` opens the SQLite database and runs migrations
 * 2. CSS is compiled from `src/client/styles.css` -> `dist/css/styles.css`
 * 3. Start h3 HTTP server with page routes and API routes
 *
 * Client JS bundles are built separately via `mise run build:js:client` (tsdown).
 *
 * Request lifecycle (page):
 *   browser GET "/" -> `inboxPage()` -> `renderPage()` -> HTML shell response
 *   -> browser loads `<script src="/dist/client/inbox.js">` (served by static handler)
 *   -> client script calls `readPageData()` to hydrate from the `<script id="page-data">` JSON blob
 *   -> client script imperatively builds DOM into `<main id="app">`
 *
 * Request lifecycle (API):
 *   browser fetch POST "/api/tasks/:id/complete"
 *   -> matched by h3 router -> handler reads/writes DB -> JSON response
 */
import { readFile, stat, } from 'node:fs/promises';
import { join, } from 'node:path';
import { H3, HTTPError, defineHandler, getRouterParam, serve, serveStatic, } from 'h3';
import { build as buildCSS } from "@monochromatic-dev/build-tool-css/ts";
// Side-effect: opens SQLite database and runs schema migrations on import
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
const DEFAULT_PORT = 3000;

/**
 * Resolves the HTTP listen port from CLI arguments, environment, or default.
 * Priority: `--port=N` > `PORT` env var > `DEFAULT_PORT`.
 */
function resolvePort(): number {
  const argumentPort = getArgumentValue("port");
  const environmentPort = process.env.PORT;
  const rawPort = argumentPort ?? environmentPort;
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);
  return Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
}

/**
 * Extracts a required route parameter, throwing 400 if missing.
 * @param event - h3 event
 * @param name - Parameter name from the route pattern
 * @returns Parameter value
 * @throws {HTTPError} 400 when parameter is missing
 */
function requireParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name,);
  if (value === undefined) {
    throw new HTTPError({ status: 400, message: `missing route parameter: ${name}`, },);
  }
  return value;
}

// Step 2: compile global CSS (resolves @apply rules, produces plain CSS)
await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/css/styles.css",
});

// Step 3: build h3 application.

const app = new H3();

//region Page routes -- return full HTML documents (via renderPage / inline HTML)

app.get('/', defineHandler(() => inboxPage()));
app.get('/in-progress', defineHandler(() => inProgressPage()));

app.get('/tasks/:id', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return taskDetailsPage(id,);
}));

app.get('/search', defineHandler((event) => searchPage(event.url,)));
app.get('/settings', defineHandler(() => settingsPage()));

//endregion Page routes

//region API routes -- return JSON

app.post('/api/tasks', defineHandler((event) => handleCreateTask(event.req,)));

app.put('/api/tasks/:id', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleUpdateTask(event.req, id,);
}));

app.delete('/api/tasks/:id', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleDeleteTask(id,);
}));

app.post('/api/tasks/:id/start', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleStartTimer(id,);
}));

app.post('/api/tasks/:id/stop', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleStopTimer(id,);
}));

app.post('/api/tasks/:id/complete', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleCompleteTask(id,);
}));

app.post('/api/ai/autofill', defineHandler((event) => handleAutofill(event.req,)));

//endregion API routes

//region Static asset serving -- bundled JS and CSS from dist/client/

app.get('/dist/client/**', defineHandler((event) => {
  return serveStatic(event, {
    getContents: (id) => readFile(join('.', id,),),
    getMeta: async (id) => {
      const stats = await stat(join('.', id,),).catch(() => undefined,);
      if (stats === undefined || !stats.isFile()) {
        return undefined;
      }
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
}));

//endregion Static asset serving

// Step 4: Start server.
const server = serve(app, { port: resolvePort(), },);

console.log(`Listening on ${server.url}`);
