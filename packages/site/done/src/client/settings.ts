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
const calendarGroup = document.createElement("setting-group");
calendarGroup.setAttribute("label", "System calendar");
calendarGroup.setAttribute("description", "Connect to start two-way auto-syncing.");
calendarGroup.setAttribute("mode", "button");
app.append(calendarGroup);
//endregion Calendar connect

//region Data privacy
const privacyGroup = document.createElement("setting-group");
privacyGroup.setAttribute("label", "Data privacy");
privacyGroup.setAttribute("description", "We never sell your data, and we never will.");
privacyGroup.setAttribute("on", "");
app.append(privacyGroup);
//endregion Data privacy

//region Dark theme
const themeGroup = document.createElement("setting-group");
themeGroup.setAttribute("label", "Dark theme");
themeGroup.setAttribute("description", "Unlock the dark side.");
app.append(themeGroup);
//endregion Dark theme
