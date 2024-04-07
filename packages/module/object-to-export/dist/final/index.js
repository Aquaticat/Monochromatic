var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import typeOf from "@monochromatic.dev/module-type-of";
var unsupported = Object.freeze(["null", "undefined", "NaN", "bigint", "symbol", "date"]);
var primitive = Object.freeze(["boolean", "string", "number"]);
function toExport(obj) {
  const objType = typeOf(obj);
  if (unsupported.includes(objType))
    throw new TypeError(`Unsupported obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
  if (primitive.includes(objType)) {
    switch (objType) {
      case "boolean": {
        return String(obj);
      }
      case "number": {
        return String(obj);
      }
      case "string": {
        return `\`${obj}\``;
      }
    }
  }
  switch (objType) {
    case "set": {
      return `Object.freeze(new Set([${Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
    }
    case "map": {
      return `Object.freeze(new Map([${Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
    }
    case "array": {
      return `Object.freeze([${obj.map((i) => toExport(i))}])`;
    }
    case "object": {
      return `Object.freeze(Object.fromEntries([${Object.entries(obj).map(
        ([k, v]) => `[${toExport(k)}, ${toExport(v)}]`
      )}]))`;
    }
    default: {
      throw new TypeError(`Unknown obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
    }
  }
}
__name(toExport, "toExport");
export {
  toExport as default
};
//# sourceMappingURL=index.js.map
