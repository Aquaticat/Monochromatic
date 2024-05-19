// src/index.ts
var src_default = {
  Declaration: {
    custom: {
      // @ts-expect-error
      size(property) {
        if (property.value[0].type === "length") {
          const value = {
            type: "length-percentage",
            value: { type: "dimension", value: property.value[0].value }
          };
          return [
            { property: "inline-size", value },
            { property: "block-size", value }
          ];
        }
      }
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
