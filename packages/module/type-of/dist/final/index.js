var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var src_default = /* @__PURE__ */ __name((obj) => {
  switch (true) {
    case obj === null: {
      return "null";
    }
    case obj === void 0: {
      return "undefined";
    }
    case Number.isNaN(obj): {
      return "NaN";
    }
    case typeof obj === "number": {
      return "number";
    }
    case typeof obj === "boolean": {
      return "boolean";
    }
    case typeof obj === "bigint": {
      return "bigint";
    }
    case typeof obj === "symbol": {
      return "symbol";
    }
    case typeof obj === "string": {
      return "string";
    }
    case Array.isArray(obj): {
      return "array";
    }
    case obj instanceof Date: {
      return "date";
    }
    case obj instanceof Set: {
      return "set";
    }
    case obj instanceof Map: {
      return "map";
    }
    case String(obj).startsWith("[object Object]"): {
      return "object";
    }
    default:
      throw TypeError(`Unrecognized obj ${obj} ${JSON.stringify(obj)} ${typeof obj}`);
  }
}, "default");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
