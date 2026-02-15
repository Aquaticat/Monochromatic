import { listInProgressTasks } from "../../lib/db/tasks.ts";
import { renderPage } from "./layout.ts";

export function inProgressPage(): Response {
  const tasks = listInProgressTasks();

  return renderPage({
    title: "In Progress - Done",
    heading: "In Progress",
    entryScriptPath: "/dist/client/in-progress.js",
    pageData: { tasks },
  });
}
