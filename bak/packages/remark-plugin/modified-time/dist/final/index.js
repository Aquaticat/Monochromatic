var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { statSync } from "node:fs";
function remarkModifiedTime() {
  return (_tree, file) => {
    const filepath = file.history[0];
    const result = statSync(filepath);
    file.data.astro.frontmatter.updated = result.mtime.toISOString();
  };
}
__name(remarkModifiedTime, "remarkModifiedTime");
export {
  remarkModifiedTime as default
};
//# sourceMappingURL=index.js.map
