var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var notNullishOrThrow = /* @__PURE__ */ __name(function notNullishOrThrow2(potentiallyNullish) {
  if (potentiallyNullish === null || typeof potentiallyNullish === "undefined") {
    throw new TypeError(`${potentiallyNullish} is nullish`);
  }
  return potentiallyNullish;
}, "notNullishOrThrow");
var notUndefinedOrThrow = /* @__PURE__ */ __name(function notUndefinedOrThrow2(potentiallyUndefined) {
  if (typeof potentiallyUndefined === "undefined") {
    throw new TypeError(`${potentiallyUndefined} is undefined`);
  }
  return potentiallyUndefined;
}, "notUndefinedOrThrow");
var notNullOrThrow = /* @__PURE__ */ __name(function notNullOrThrow2(potentiallyNull) {
  if (potentiallyNull === null) {
    throw new TypeError(`${potentiallyNull} is null`);
  }
  return potentiallyNull;
}, "notNullOrThrow");
var notFalsyOrThrow = /* @__PURE__ */ __name(function notFalsyOrThrow2(potentiallyFalsy) {
  if (!potentiallyFalsy) {
    throw new TypeError(`${potentiallyFalsy} is null`);
  }
  return potentiallyFalsy;
}, "notFalsyOrThrow");
export {
  notFalsyOrThrow,
  notNullOrThrow,
  notNullishOrThrow,
  notUndefinedOrThrow
};
//# sourceMappingURL=index.js.map
