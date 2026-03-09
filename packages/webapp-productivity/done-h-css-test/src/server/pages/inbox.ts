/**
 * Inbox page handler.
 *
 * Queries the DB for inbox tasks, then delegates to the shared `renderPage()` shell.
 * The `entryScriptPath` tells the browser to load `/dist/client/inbox.js`,
 * which reads `pageData` from the embedded JSON blob and builds the UI into `<main id="app">`.
 */
import { listBlockedInboxTasks, listInboxUnblockedTasks } from "../../lib/db/tasks.ts";
import { renderPage } from "./layout.ts";

/** Renders the inbox page with unblocked and blocked task lists. */
export function inboxPage(): Response {
  const inboxTasks = listInboxUnblockedTasks();
  const blockedLinks = listBlockedInboxTasks();
  const blockedTasksByBlocker = Object.groupBy(blockedLinks, (link) => link.blockerId);

  return renderPage({
    title: "Inbox - Done",
    heading: "Inbox",
    entryScriptPath: "/dist/client/inbox.js",
    pageData: {
      suggestedTasks: inboxTasks,
      allTasks: inboxTasks,
      blockedTasksByBlocker,
    },
  });
}
