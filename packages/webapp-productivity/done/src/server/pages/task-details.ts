/**
 * Task detail page handler.
 *
 * Renders its own HTML inline (not via `renderPage()`) because the task detail
 * page omits the `<top-nav>` entirely -- the `<task-detail>` web component
 * provides its own back-button header.
 *
 * Client entry: `/dist/client/task-details.js` (src/client/task-details.ts)
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t string/t html/f/t string jsx/r s/p n/index.ts";
import { getTaskById, listTasksForBlockerPicker } from "../../lib/db/tasks.ts";
import { serializePageData } from "./layout.ts";

/**
 * Renders the task detail page for a single task with its blocker summaries.
 * @param taskId - Task UUID from the route parameter
 * @returns HTML response, or 404 when the task does not exist
 */
export async function taskDetailsPage(taskId: string): Promise<Response> {
  const task = await getTaskById(taskId);
  if (task === null) {
    return new Response("Task not found", { status: 404 });
  }

  const blockerCandidates = await listTasksForBlockerPicker(taskId);
  const blockerCandidatesById = Object.fromEntries(blockerCandidates.map((candidate) => [candidate.id, candidate]));
  const blockerSummaries = task.blockedBy
    .map((blockerId) => blockerCandidatesById[blockerId])
    .filter((candidate) => candidate !== undefined)
    .map((candidate) => ({ id: candidate.id, title: candidate.title, status: candidate.status }));

  const pageData = {
    task,
    blockerCandidates: blockerCandidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
    })),
    blockerSummaries,
  };

  const html = `<!DOCTYPE html>
` + h({
    tag: "html",
    attrs: { lang: "en" },
    children: [
      h({
        tag: "head",
        children: [
          h({ tag: "meta", attrs: { charset: "utf-8" } }),
          h({ tag: "meta", attrs: { name: "viewport", content: "width=device-width, initial-scale=1" } }),
          h({ tag: "title", text: `Task - ${task.title}` }),
        ],
      }),
      h({
        tag: "body",
        children: [
          h({ tag: "side-drawer", attrs: { id: "drawer" } }),
          h({
            tag: "div",
            class: "page-wrapper",
            children: [
              h({ tag: "main", attrs: { id: "app" } }),
            ],
          }),
          h({ tag: "script", attrs: { type: "application/json", id: "page-data" }, html: serializePageData(pageData) }),
          h({ tag: "script", attrs: { type: "module", src: "/dist/client/task-details.js" } }),
        ],
      }),
    ],
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
