var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function onDomContentLoaded() {
  document.querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.hasAttribute("open")) {
        let parentDetails;
        do {
          parentDetails = details.parentElement.closest("details:not([open])");
          if (parentDetails) {
            parentDetails.open = true;
          }
        } while (parentDetails !== null);
      }
    });
  });
}
__name(onDomContentLoaded, "onDomContentLoaded");
export {
  onDomContentLoaded as default
};
//# sourceMappingURL=index.js.map
