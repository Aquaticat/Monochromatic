/**
 * Client entry script for the Search page.
 *
 * Same hydration pattern as inbox.ts: injectCSS -> readPageData -> build DOM into #app.
 */
import type { SearchTask } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import { globalStyles } from "./styles.ts";
import { searchStyles } from "./search-styles.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/side-drawer.ts";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import "./components/search-bar.ts";

/** Shape of the JSON blob embedded in the search page by the server. */
type SearchPageData = {
  /** User's search query string. */
  query: string;
  /** Task results matching the query. */
  results: SearchTask[];
  /** All known tags for the tag chip display. */
  availableTags: string[];
};

injectCSS(globalStyles);
injectCSS(searchStyles);

/** Deserialized page data containing search query, results, and available tags. */
const pageData = readPageData<SearchPageData>();

/** Raw DOM element for the `#app` container. */
const appElement = document.querySelector<HTMLElement>("#app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}

/** Validated `#app` container element. */
const app = appElement;

// Listen for search events from the search-bar component
document.querySelector<HTMLElement>("search-bar")?.addEventListener("search", (function handleSearch(event: CustomEvent) {
  const query = event.detail.query as string;
  globalThis.location.href = query.length === 0 ? "/search" : `/search?q=${encodeURIComponent(query)}`;
}) as EventListener);

if (pageData.query.length === 0) {
  app.append(h({ tag: "p", class: "search-hint", text: "Type something...or select one of the categories." }));

  const availableTags = pageData.availableTags;
  if (availableTags.length > 0) {
    app.append(
      h({
        tag: "div",
        class: "tag-chips",
        children: availableTags.map(function buildTagChip(tag) {
          return h({
            tag: "button",
            class: "tag-chip",
            text: `# ${tag}`,
            on: {
              click: function handleTagClick() {
                globalThis.location.href = `/search?q=${encodeURIComponent(`#${tag}`)}`;
              },
            },
          });
        }),
      }),
    );
  }
} else {
  const resultList = h({ tag: "ul", class: "task-list" });

  for (const result of pageData.results) {
    resultList.append(
      createTaskCard(result, {
        showBlockedBadge: result.isBlocked,
        onOpen: function handleOpen(taskId) {
          globalThis.location.href = `/tasks/${taskId}`;
        },
        onToggleComplete: async function handleComplete(taskId) {
          await api(`/api/tasks/${taskId}/complete`, { method: "POST" });
          globalThis.location.reload();
        },
      }),
    );
  }

  if (pageData.results.length === 0) {
    app.append(h({ tag: "p", class: "empty", text: "No matching tasks." }));
  } else {
    app.append(resultList);
  }
}
