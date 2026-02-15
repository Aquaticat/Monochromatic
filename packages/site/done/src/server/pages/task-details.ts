import { getTaskById, listTasksForBlockerPicker } from "../../lib/db/tasks.ts";

function serializePageData(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

export function taskDetailsPage(taskId: string): Response {
  const task = getTaskById(taskId);
  if (task === null) {
    return new Response("Task not found", { status: 404 });
  }

  const blockerCandidates = listTasksForBlockerPicker(taskId);
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Task - ${task.title}</title>
</head>
<body>
  <side-drawer id="drawer"></side-drawer>
  <div class="page-wrapper">
    <main id="app"></main>
  </div>
  <script type="application/json" id="page-data">${serializePageData(pageData)}</script>
  <script type="module" src="/dist/client/task-details.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
