/**
 * In-progress page handler.
 *
 * Queries tasks with active timers, then delegates to the shared `renderPage()` shell.
 * Client entry: `/dist/client/in-progress.js` (src/client/in-progress.ts)
 */
import { listInProgressTasks } from "../../lib/db/tasks.ts";
import { renderPage } from "./layout.ts";

/** Renders the in-progress page listing tasks with active timers. */
export function inProgressPage(): Response {
  const tasks = listInProgressTasks();

  return renderPage({
    title: "In Progress - Done",
    heading: "In Progress",
    entryScriptPath: "/dist/client/in-progress.js",
    pageData: { tasks },
  });
}
