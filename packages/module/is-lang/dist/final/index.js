var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var isShortLang = /* @__PURE__ */ __name(function isShortLang2(str) {
  return str.length === 2 && /^[a-z]+$/.test(str);
}, "isShortLang");
var isFullLang = /* @__PURE__ */ __name(function isFullLang2(str) {
  return str.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(str);
}, "isFullLang");
function isLang(str) {
  return isShortLang(str) || isFullLang(str);
}
__name(isLang, "isLang");
export {
  isLang as default,
  isFullLang,
  isShortLang
};
//# sourceMappingURL=index.js.map
