var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import * as fs from "node:fs";
import * as path from "node:path";
import isLang from "@monochromatic.dev/module-is-lang";
var src_default = /* @__PURE__ */ __name((name = "post", recursive = false) => ({
  name: "globs",
  hooks: {
    "astro:config:setup": () => {
      const langPaths = fs.readdirSync(path.join(path.resolve(), "src", "pages")).filter((file) => isLang(file)).concat([""]);
      fs.writeFileSync(
        path.join(path.resolve(), "src", "components", "_globs.astro"),
        `
---
export const langsPosts = new Map([
  ${langPaths.map((langPath) => [
          `['${langPath}'`,
          `await Astro.glob('../pages/${langPath === "" ? "" : `${langPath}/`}${name}/${recursive ? "**/" : ""}*.mdx')]`
        ])}
]);
---
      `.trimStart()
      );
    }
  }
}), "default");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
