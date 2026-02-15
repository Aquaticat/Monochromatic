import { listAllTags, searchTasks } from "../../lib/db/tasks.ts";

function serializePageData(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

export function searchPage(url: URL): Response {
  const query = url.searchParams.get("q") ?? "";
  const results = searchTasks(query);
  const availableTags = listAllTags();

  const pageData = { query, results, availableTags };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Search - Done</title>
</head>
<body>
  <side-drawer id="drawer"></side-drawer>
  <div class="page-wrapper">
    <search-bar value="${query.replaceAll('"', '&quot;')}"></search-bar>
    <main id="app"></main>
  </div>
  <script type="application/json" id="page-data">${serializePageData(pageData)}</script>
  <script type="module" src="/dist/client/search.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
