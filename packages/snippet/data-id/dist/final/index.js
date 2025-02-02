var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var getElementByDataId = /* @__PURE__ */ __name((dataId) => {
  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (node) => {
    const htmlElement = node;
    for (const data in htmlElement.dataset) {
      if (/^id[A-Z0-9]/.test(data)) {
        if (htmlElement.dataset[data] === dataId) {
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    }
    return NodeFilter.FILTER_SKIP;
  });
  return treeWalker.nextNode();
}, "getElementByDataId");
function onDomContentLoaded() {
  if (location.hash) {
    const potentialId = location.hash.slice(1);
    if (document.querySelector(`#${potentialId}`)) {
    } else {
      const elementWithDataId = getElementByDataId(potentialId);
      if (elementWithDataId) {
        elementWithDataId.scrollIntoView();
        elementWithDataId.focus();
      }
    }
  }
}
__name(onDomContentLoaded, "onDomContentLoaded");
export {
  onDomContentLoaded as default,
  getElementByDataId
};
//# sourceMappingURL=index.js.map
