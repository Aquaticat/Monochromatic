import type { SearchTask } from "../lib/types.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import "./components/side-drawer.ts";
import "./components/search-bar.ts";

type SearchPageData = {
  query: string;
  results: SearchTask[];
  availableTags: string[];
};

injectCSS(styles);

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
  const hint = document.createElement("p");
  hint.className = "search-hint";
  hint.textContent = "Type something...or select one of the categories.";
  app.append(hint);

  const availableTags = pageData.availableTags ?? [];
  if (availableTags.length > 0) {
    const tagChips = document.createElement("div");
    tagChips.className = "tag-chips";

    for (const tag of availableTags) {
      const chip = document.createElement("button");
      chip.className = "tag-chip";
      chip.textContent = `# ${tag}`;
      chip.addEventListener("click", () => {
        window.location.href = `/search?q=${encodeURIComponent(`#${tag}`)}`;
      });
      tagChips.append(chip);
    }

    app.append(tagChips);
  }
} else {
  const resultList = document.createElement("ul");
  resultList.className = "task-list";

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
      })
    );
  }

  if (pageData.results.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty";
    emptyState.textContent = "No matching tasks.";
    app.append(emptyState);
  } else {
    app.append(resultList);
  }
}
