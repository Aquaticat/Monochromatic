var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var trimEndWith = /* @__PURE__ */ __name((str, trimmer) => {
  const reversedTrimmer = trimmer.split("").toReversed().join();
  let modifingString = str;
  while (modifingString.endsWith(trimmer)) {
    modifingString = modifingString.split("").toReversed().join("").replace(reversedTrimmer, "").split("").toReversed().join("");
  }
  return modifingString;
}, "trimEndWith");
var src_default = trimEndWith;
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
