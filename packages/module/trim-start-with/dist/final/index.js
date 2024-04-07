var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var trimStartWith = /* @__PURE__ */ __name((str, trimmer) => {
  let modifingString = str;
  while (modifingString.startsWith(trimmer)) {
    modifingString = modifingString.replace(trimmer, "");
  }
  return modifingString;
}, "trimStartWith");
var src_default = trimStartWith;
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
