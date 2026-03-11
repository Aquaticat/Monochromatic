/**
 * Client entry script for the Search page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 * The search page's HTML shell (rendered inline by the server, not via renderPage)
 * places a `<search-bar>` above `<main id="app">` instead of a `<top-nav>`.
 */
import type { SearchTask } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import styles from "../../dist/css/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import "./components/side-drawer.ts";
import "./components/search-bar.ts";

/** Shape of the JSON blob embedded in the search page by the server. */
type SearchPageData = {
  query: string;
  results: SearchTask[];
  availableTags: string[];
};

injectCSS(styles);

// Page-scoped styles for search (not shared with other pages)
injectCSS(`
.search-hint {
  color: var(--fg-weaker);
  font-size: 1rem;
  line-height: 1.5;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--min-gap);
}

.tag-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  border-width: calc(1 / 16 * 1rem);
  border-style: solid;
  border-color: var(--fg);
  border-radius: 62.5rem;
  padding-block: 0.5rem;
  padding-inline: 0.5rem;
  gap: 0.25rem;
  white-space: nowrap;
  font-size: 1rem;
  line-height: 1.5;
  cursor: pointer;
  background-color: transparent;
  font: inherit;

  &:hover {
    background-color: var(--hover-bg);
  }
}

@media (min-width: 48rem) {
  .search-hint {
    font-size: 1.5rem;
  }
}
`);

const pageData = readPageData<SearchPageData>();
const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

// Listen for search events from the search-bar component
document.querySelector("search-bar")?.addEventListener("search", ((event: CustomEvent) => {
  const query = event.detail.query as string;
  window.location.href = query.length === 0 ? "/search" : `/search?q=${encodeURIComponent(query)}`;
}) as EventListener);

if (pageData.query.length === 0) {
  app.append(h({ tag: "p", class: "search-hint", text: "Type something...or select one of the categories." }));

  const availableTags = pageData.availableTags ?? [];
  if (availableTags.length > 0) {
    app.append(
      h({
        tag: "div",
        class: "tag-chips",
        children: availableTags.map((tag) =>
          h({
            tag: "button",
            class: "tag-chip",
            text: `# ${tag}`,
            on: {
              click: () => {
                window.location.href = `/search?q=${encodeURIComponent(`#${tag}`)}`;
              },
            },
          }),
        ),
      }),
    );
  }
} else {
  const resultList = h({ tag: "ul", class: "task-list" });

  for (const result of pageData.results) {
    resultList.append(
      createTaskCard(result, {
        showBlockedBadge: result.isBlocked,
        onOpen: (taskId) => {
          window.location.href = `/tasks/${taskId}`;
        },
        onToggleComplete: async (taskId) => {
          await api(`/api/tasks/${taskId}/complete`, { method: "POST" });
          window.location.reload();
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
