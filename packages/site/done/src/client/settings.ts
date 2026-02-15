/**
 * Client entry script for the Settings page.
 *
 * Same hydration pattern as inbox.ts: injectCSS → readPageData → build DOM into #app.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import styles from "../../dist/client/styles.css" with { type: "text" };
import { injectCSS } from "./lib/inject-css.ts";
import { readPageData } from "./lib/page-data.ts";
import "./components/side-drawer.ts";
import "./components/top-nav.ts";
import "./components/setting-group.ts";

type SettingsPageData = {
  message: string;
};

injectCSS(styles);

const _pageData = readPageData<SettingsPageData>();
const appElement = document.getElementById("app");
if (!(appElement instanceof HTMLElement)) {
  throw new Error("Missing app element");
}
const app = appElement;

//region Calendar connect
app.append(
  h({
    tag: "setting-group",
    attrs: { label: "System calendar", description: "Connect to start two-way auto-syncing.", mode: "button" },
  }),
);
//endregion Calendar connect

//region Data privacy
app.append(
  h({
    tag: "setting-group",
    attrs: { label: "Data privacy", description: "We never sell your data, and we never will.", on: "" },
  }),
);
//endregion Data privacy

//region Dark theme
app.append(
  h({
    tag: "setting-group",
    attrs: { label: "Dark theme", description: "Unlock the dark side." },
  }),
);
//endregion Dark theme
