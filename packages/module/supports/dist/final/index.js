var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var popover = /* @__PURE__ */ __name(() => HTMLElement.prototype.hasOwnProperty("popover"), "popover");
var has = /* @__PURE__ */ __name(() => CSS.supports("selector(body:has(p))"), "has");
var logicalViewport = /* @__PURE__ */ __name(() => CSS.supports("inline-size", "1dvi"), "logicalViewport");
var containerQuery = /* @__PURE__ */ __name(() => CSS.supports("inline-size", "1cqi"), "containerQuery");
var contentVisibility = /* @__PURE__ */ __name(() => CSS.supports("content-visibility", "auto"), "contentVisibility");
var logicalOverflow = /* @__PURE__ */ __name(() => CSS.supports("overflow-block", "auto"), "logicalOverflow");
var textSizeAdjust = /* @__PURE__ */ __name(() => CSS.supports("text-size-adjust", "50%"), "textSizeAdjust");
var autoFocus = /* @__PURE__ */ __name(() => HTMLElement.prototype.hasOwnProperty("autofocus"), "autoFocus");
var src_default = /* @__PURE__ */ __name(() => [popover(), autoFocus()].every((v) => v === true), "default");
export {
  autoFocus,
  containerQuery,
  contentVisibility,
  src_default as default,
  has,
  logicalOverflow,
  logicalViewport,
  popover,
  textSizeAdjust
};
//# sourceMappingURL=index.js.map
