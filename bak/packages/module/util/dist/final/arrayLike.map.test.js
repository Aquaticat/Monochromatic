var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/arrayLike.map.test.ts
import { configure } from "@logtape/logtape";

// src/logtape.ts
import {
  getConsoleSink,
  getFileSink,
  getLevelFilter,
  withFilter
} from "@logtape/logtape";
// @__NO_SIDE_EFFECTS__
function logtapeConfiguration(appName = "monochromatic") {
  return {
    sinks: {
      console: getConsoleSink(),
      consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter("info")),
      consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter("warning")),
      file: getFileSink(`${appName}.log`, {
        formatter(log) {
          return `${JSON.stringify(log, null, 2)}
`;
        }
      })
    },
    filters: {},
    loggers: [
      /* a is short for app, m is short for module, t is short for test
         Sorry, but terminal space is precious. */
      { category: ["a"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["t"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["m"], level: "debug", sinks: ["file", "consoleWarnPlus"] },
      {
        category: ["esbuild-plugin"],
        level: "debug",
        sinks: ["file", "consoleWarnPlus"]
      },
      { category: ["logtape", "meta"], level: "warning", sinks: ["console"] }
    ]
  };
}
__name(logtapeConfiguration, "logtapeConfiguration");

// src/arrayLike.map.test.ts
await configure(logtapeConfiguration());
//# sourceMappingURL=arrayLike.map.test.js.map
