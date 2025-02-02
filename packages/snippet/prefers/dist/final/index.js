var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { piped } from "rambdax";
var prefers = piped(
  [
    piped(
      ["contrast", "reduced-motion", "reduced-data", "reduced-transparency"],
      (val) => val.map((directive) => [
        directive,
        piped(["toggle", "true", "false"], (val2) => new Set(val2))
      ])
    ),
    piped(
      ["color-scheme"],
      (val) => val.map((directive) => [
        directive,
        piped(["toggle", "light", "dark"], (val2) => new Set(val2))
      ])
    )
  ],
  (val) => val.flat(),
  (val) => new Map(val)
);
function onDomContentLoaded() {
  prefers.forEach((possibleVals, prefer) => {
    const preferVal = new URLSearchParams(location.search).get(prefer);
    if (preferVal) {
      if (possibleVals.has(preferVal)) {
        document.documentElement.setAttribute(`data-${prefer}`, preferVal);
      } else {
        throw TypeError(
          `query param ${prefer}'s value must be one of ${JSON.stringify(possibleVals)}, got ${preferVal}`
        );
      }
    }
  });
}
__name(onDomContentLoaded, "onDomContentLoaded");
export {
  onDomContentLoaded as default,
  prefers
};
//# sourceMappingURL=index.js.map
