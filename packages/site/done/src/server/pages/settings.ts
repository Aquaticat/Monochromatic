/**
 * Settings page handler.
 *
 * Delegates to the shared `renderPage()` shell with a placeholder data payload.
 * Client entry: `/dist/client/settings.js` (src/client/settings.ts)
 */
import { renderPage } from "./layout.ts";

export function settingsPage(): Response {
  return renderPage({
    title: "Settings - Done",
    heading: "Settings",
    entryScriptPath: "/dist/client/settings.js",
    pageData: {
      message: "Settings UI will be expanded in the next slice.",
    },
  });
}
