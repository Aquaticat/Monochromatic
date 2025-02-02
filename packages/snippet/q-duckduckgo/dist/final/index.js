var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function onDomContentLoaded() {
  const q = new URLSearchParams(location.search).get("q");
  if (q) {
    location.href = `https://duckduckgo.com/?q=${encodeURIComponent(q)}+${encodeURIComponent(
      `site:${location.origin}`
    )}`;
  }
}
__name(onDomContentLoaded, "onDomContentLoaded");
export {
  onDomContentLoaded as default
};
//# sourceMappingURL=index.js.map
