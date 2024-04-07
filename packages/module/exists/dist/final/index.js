var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var src_default = /* @__PURE__ */ __name(async (url) => {
  try {
    return await fetch(url).then((response) => response.ok);
  } catch {
    return false;
  }
}, "default");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
