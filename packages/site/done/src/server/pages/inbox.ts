import { listBlockedInboxTasks, listInboxUnblockedTasks } from "../../lib/db/tasks.ts";
import { renderPage } from "./layout.ts";

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
