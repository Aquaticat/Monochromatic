/**
 * Application entry point.
 *
 * Boot sequence:
 * 1. Side-effect import of `./lib/db.ts` opens the SQLite database and runs migrations
 * 2. CSS is compiled from `src/client/styles.css` → `dist/client/styles.css`
 * 3. Client entry scripts are bundled by `Bun.build` → `dist/client/*.js`
 * 4. If `--build-only` was passed, exit here (CI / pre-deploy use case)
 * 5. Otherwise start Bun HTTP server with page routes and API routes
 *
 * Request lifecycle (page):
 *   browser GET "/" → `inboxPage()` → `renderPage()` → HTML shell response
 *   → browser loads `<script src="/dist/client/inbox.js">` (served by `fetch` handler)
 *   → client script calls `readPageData()` to hydrate from the `<script id="page-data">` JSON blob
 *   → client script imperatively builds DOM into `<main id="app">`
 *
 * Request lifecycle (API):
 *   browser fetch POST "/api/tasks/:id/complete"
 *   → matched by `routes` object → handler reads/writes DB → JSON response
 */
import { build as buildCSS } from "@monochromatic-dev/build-css/ts";
// Side-effect: opens SQLite database and runs schema migrations on import
import "./lib/db.ts";
import { handleCreateTask, handleDeleteTask, handleUpdateTask } from "./server/api/tasks.ts";
import { handleCompleteTask, handleStartTimer, handleStopTimer } from "./server/api/timer.ts";
import { inProgressPage } from "./server/pages/in-progress.ts";
import { inboxPage } from "./server/pages/inbox.ts";
import { searchPage } from "./server/pages/search.ts";
import { settingsPage } from "./server/pages/settings.ts";
import { taskDetailsPage } from "./server/pages/task-details.ts";

const DEFAULT_PORT = 3000;

function getArgumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  return argument?.slice(prefix.length);
}

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

const buildOnly = process.argv.includes("--build-only");

// Step 2: compile global CSS (resolves @apply rules, produces plain CSS)
await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/client/styles.css",
});

// Step 3: bundle one JS entry per page; each becomes a `<script type="module">` in the HTML shell.
// The `css()` macro calls inside component files are expanded at bundle time (see css.macro.ts).
const buildResult = await Bun.build({
  entrypoints: [
    "./src/client/inbox.ts",
    "./src/client/in-progress.ts",
    "./src/client/task-details.ts",
    "./src/client/search.ts",
    "./src/client/settings.ts",
  ],
  outdir: "./dist/client",
  target: "browser",
  minify: process.env.NODE_ENV === "production",
});

if (!buildResult.success) {
  throw new Error(`Client build failed: ${JSON.stringify(buildResult.logs)}`);
}

if (buildOnly) {
  console.log("Build completed.");
} else {
  // Step 5: start HTTP server.
  // Page routes return full HTML documents (via renderPage / inline HTML).
  // API routes return JSON. Static assets (dist/client/*) are served by the fallback `fetch` handler.
  const server = Bun.serve({
    port: resolvePort(),
    routes: {
      // Each page handler queries the DB, then returns an HTML shell containing
      // a <script id="page-data"> JSON blob and a <script type="module"> pointing
      // at the corresponding bundled client entry (e.g. /dist/client/inbox.js).
      "/": () => inboxPage(),
      "/in-progress": () => inProgressPage(),
      "/tasks/:id": (req) => taskDetailsPage(req.params.id),
      "/search": (req) => searchPage(new URL(req.url)),
      "/settings": () => settingsPage(),

      "/api/tasks": { POST: (req) => handleCreateTask(req) },
      "/api/tasks/:id": {
        PUT: (req) => handleUpdateTask(req, req.params.id),
        DELETE: (req) => handleDeleteTask(req.params.id),
      },
      "/api/tasks/:id/start": { POST: (req) => handleStartTimer(req.params.id) },
      "/api/tasks/:id/stop": { POST: (req) => handleStopTimer(req.params.id) },
      "/api/tasks/:id/complete": { POST: (req) => handleCompleteTask(req.params.id) },
    },
    // Fallback handler: serves bundled JS and CSS from dist/client/ as static files.
    // Bun's `routes` only match exact patterns; this catches asset requests.
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/dist/client/")) {
        const file = Bun.file(`.${path}`);
        if (await file.exists()) {
          return new Response(file);
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Listening on http://localhost:${server.port}`);
}
