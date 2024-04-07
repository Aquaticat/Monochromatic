var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function isLang(str) {
  return str.length === 2 && /^[a-z]+$/.test(str) || str.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(str);
}
__name(isLang, "isLang");
export {
  isLang as default
};
//# sourceMappingURL=index.js.map
