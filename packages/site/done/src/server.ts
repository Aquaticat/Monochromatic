import { build as buildCSS } from "@monochromatic-dev/build-css/ts";
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

await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/client/styles.css",
});

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
  const server = Bun.serve({
    port: resolvePort(),
    routes: {
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
