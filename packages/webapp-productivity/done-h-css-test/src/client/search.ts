/**
 * Client entry script for the Search page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 * The search page's HTML shell (rendered inline by the server, not via renderPage)
 * places a `<search-bar>` above `<main id="app">` instead of a `<top-nav>`.
 */
import type { SearchTask } from "../lib/types.ts";
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { api } from "./lib/api.ts";
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import { createTaskCard } from "./lib/task-card.ts";
import { globalStyles } from "./styles.ts";
import { $ as css } from "./css.ts";
import { cssCalc, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { borderRadiusFull, flexCenter, whitespaceNowrap } from "./mixins.ts";
import "./components/side-drawer.ts";
import "./components/search-bar.ts";

/** Shape of the JSON blob embedded in the search page by the server. */
type SearchPageData = {
  query: string;
  results: SearchTask[];
  availableTags: string[];
};

injectCSS(globalStyles);

// Page-scoped styles for search (not shared with other pages)
injectCSS([
  css({
    rule: '.search-hint',
    decls: { color: cssVar('fg-weaker'), 'font-size': cssRem(1), 'line-height': 1.5 },
  }),
  css({
    rule: '.tag-chips',
    decls: { display: 'flex', 'flex-wrap': 'wrap', gap: cssVar('min-gap') },
  }),
  css({
    rule: '.tag-chip',
    decls: {
      ...flexCenter(),
      ...whitespaceNowrap(),
      ...borderRadiusFull(),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      'padding-block': cssRem(0.5),
      'padding-inline': cssRem(0.5),
      gap: cssRem(0.25),
      cursor: 'pointer',
      'background-color': 'transparent',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
    },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': cssVar('hover-bg') } }),
    ],
  }),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({ rule: '.search-hint', decls: { 'font-size': cssRem(1.5) } }),
    ],
  }),
].join(''));

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
