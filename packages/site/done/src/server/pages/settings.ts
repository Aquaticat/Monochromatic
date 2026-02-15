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
