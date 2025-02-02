// src/index.ts
var src_default = {
  Rule: {
    style(rule) {
      const valuesByProperty = /* @__PURE__ */ new Map();
      for (const decl of rule.value.declarations.declarations) {
        let name = decl.property;
        if (decl.property === "unparsed") {
          name = decl.value.propertyId.property;
        }
        valuesByProperty.set(name, decl);
      }
      rule.value.declarations.declarations = rule.value.declarations.declarations.map((decl) => {
        if (decl.property === "unparsed" && decl.value.value.length === 1) {
          const token = decl.value.value[0];
          if (token.type === "token" && token.value.type === "at-keyword" && valuesByProperty.has(token.value.value)) {
            const v = valuesByProperty.get(token.value.value);
            return {
              /** @type any */
              property: decl.value.propertyId.property,
              value: v.value
            };
          }
        }
        return decl;
      });
      return rule;
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
