var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../node_modules/@jsr/std__assert/assertion_error.js
var AssertionError = class extends Error {
  static {
    __name(this, "AssertionError");
  }
  /** Constructs a new instance.
   *
   * @param message The error message.
   * @param options Additional options. This argument is still unstable. It may change in the future release.
   */
  constructor(message, options) {
    super(message, options);
    this.name = "AssertionError";
  }
};

// ../../../node_modules/@std/expect/_custom_equality_tester.js
var customEqualityTesters = [];
function addCustomEqualityTesters(newTesters) {
  if (!Array.isArray(newTesters)) {
    throw new TypeError(`customEqualityTester expects an array of Testers. But got ${typeof newTesters}`);
  }
  customEqualityTesters.push(...newTesters);
}
__name(addCustomEqualityTesters, "addCustomEqualityTesters");
function getCustomEqualityTesters() {
  return customEqualityTesters;
}
__name(getCustomEqualityTesters, "getCustomEqualityTesters");

// ../../../node_modules/@std/expect/_asymmetric_matchers.js
var AsymmetricMatcher = class {
  static {
    __name(this, "AsymmetricMatcher");
  }
  value;
  constructor(value) {
    this.value = value;
  }
};
var Anything = class extends AsymmetricMatcher {
  static {
    __name(this, "Anything");
  }
  equals(other) {
    return other !== null && other !== void 0;
  }
};
function anything() {
  return new Anything();
}
__name(anything, "anything");
var Any = class extends AsymmetricMatcher {
  static {
    __name(this, "Any");
  }
  constructor(value) {
    if (value === void 0) {
      throw new TypeError("Expected a constructor function");
    }
    super(value);
  }
  equals(other) {
    if (typeof other === "object") {
      return other instanceof this.value;
    } else {
      if (this.value === Number) {
        return typeof other === "number";
      }
      if (this.value === String) {
        return typeof other === "string";
      }
      if (this.value === Number) {
        return typeof other === "number";
      }
      if (this.value === Function) {
        return typeof other === "function";
      }
      if (this.value === Boolean) {
        return typeof other === "boolean";
      }
      if (this.value === BigInt) {
        return typeof other === "bigint";
      }
      if (this.value === Symbol) {
        return typeof other === "symbol";
      }
    }
    return false;
  }
};
function any(c) {
  return new Any(c);
}
__name(any, "any");
var ArrayContaining = class extends AsymmetricMatcher {
  static {
    __name(this, "ArrayContaining");
  }
  constructor(arr) {
    super(arr);
  }
  equals(other) {
    return Array.isArray(other) && this.value.every((e) => other.includes(e));
  }
};
function arrayContaining(c) {
  return new ArrayContaining(c);
}
__name(arrayContaining, "arrayContaining");
var CloseTo = class extends AsymmetricMatcher {
  static {
    __name(this, "CloseTo");
  }
  #precision;
  constructor(num, precision = 2) {
    super(num);
    this.#precision = precision;
  }
  equals(other) {
    if (typeof other !== "number") {
      return false;
    }
    if (this.value === Number.POSITIVE_INFINITY && other === Number.POSITIVE_INFINITY || this.value === Number.NEGATIVE_INFINITY && other === Number.NEGATIVE_INFINITY) {
      return true;
    }
    return Math.abs(this.value - other) < Math.pow(10, -this.#precision) / 2;
  }
};
function closeTo(num, numDigits) {
  return new CloseTo(num, numDigits);
}
__name(closeTo, "closeTo");
var StringContaining = class extends AsymmetricMatcher {
  static {
    __name(this, "StringContaining");
  }
  constructor(str) {
    super(str);
  }
  equals(other) {
    if (typeof other !== "string") {
      return false;
    }
    return other.includes(this.value);
  }
};
function stringContaining(str) {
  return new StringContaining(str);
}
__name(stringContaining, "stringContaining");
var StringMatching = class extends AsymmetricMatcher {
  static {
    __name(this, "StringMatching");
  }
  constructor(pattern) {
    super(new RegExp(pattern));
  }
  equals(other) {
    if (typeof other !== "string") {
      return false;
    }
    return this.value.test(other);
  }
};
function stringMatching(pattern) {
  return new StringMatching(pattern);
}
__name(stringMatching, "stringMatching");

// ../../../node_modules/@std/expect/_equal.js
function isKeyedCollection(x) {
  return [
    Symbol.iterator,
    "size"
  ].every((k) => k in x);
}
__name(isKeyedCollection, "isKeyedCollection");
function constructorsEqual(a, b) {
  return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
__name(constructorsEqual, "constructorsEqual");
function asymmetricEqual(a, b) {
  const asymmetricA = a instanceof AsymmetricMatcher;
  const asymmetricB = b instanceof AsymmetricMatcher;
  if (asymmetricA && asymmetricB) {
    return void 0;
  }
  if (asymmetricA) {
    return a.equals(b);
  }
  if (asymmetricB) {
    return b.equals(a);
  }
}
__name(asymmetricEqual, "asymmetricEqual");
function equal(c, d, options) {
  const { customTesters = [], strictCheck } = options || {};
  const seen = /* @__PURE__ */ new Map();
  return (/* @__PURE__ */ __name(function compare(a, b) {
    if (customTesters?.length) {
      for (const customTester of customTesters) {
        const testContext = {
          equal
        };
        const pass = customTester.call(testContext, a, b, customTesters);
        if (pass !== void 0) {
          return pass;
        }
      }
    }
    if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
      return String(a) === String(b);
    }
    const asymmetric = asymmetricEqual(a, b);
    if (asymmetric !== void 0) {
      return asymmetric;
    }
    if (a instanceof Date && b instanceof Date) {
      const aTime = a.getTime();
      const bTime = b.getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return true;
      }
      return aTime === bTime;
    }
    if (a instanceof Error && b instanceof Error) {
      return a.message === b.message;
    }
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b) || a === b;
    }
    if (a === null || b === null) {
      return a === b;
    }
    const className = Object.prototype.toString.call(a);
    if (className !== Object.prototype.toString.call(b)) {
      return false;
    }
    if (Object.is(a, b)) {
      return true;
    }
    if (a && typeof a === "object" && b && typeof b === "object") {
      if (strictCheck && a && b && !constructorsEqual(a, b)) {
        return false;
      }
      if (a instanceof WeakMap || b instanceof WeakMap) {
        if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
        throw new TypeError("Cannot compare WeakMap instances");
      }
      if (a instanceof WeakSet || b instanceof WeakSet) {
        if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
        throw new TypeError("Cannot compare WeakSet instances");
      }
      if (seen.get(a) === b) {
        return true;
      }
      const aKeys = Object.keys(a || {});
      const bKeys = Object.keys(b || {});
      let aLen = aKeys.length;
      let bLen = bKeys.length;
      if (!strictCheck) {
        if (aLen > 0) {
          for (let i = 0; i < aKeys.length; i += 1) {
            const key = aKeys[i];
            if (key in a && a[key] === void 0 && !(key in b)) {
              aLen -= 1;
            }
          }
        }
        if (bLen > 0) {
          for (let i = 0; i < bKeys.length; i += 1) {
            const key = bKeys[i];
            if (key in b && b[key] === void 0 && !(key in a)) {
              bLen -= 1;
            }
          }
        }
      }
      if (aLen !== bLen) {
        return false;
      }
      seen.set(a, b);
      if (isKeyedCollection(a) && isKeyedCollection(b)) {
        if (a.size !== b.size) {
          return false;
        }
        let unmatchedEntries = a.size;
        for (const [aKey, aValue] of a.entries()) {
          for (const [bKey, bValue] of b.entries()) {
            if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
              unmatchedEntries--;
              break;
            }
          }
        }
        return unmatchedEntries === 0;
      }
      const merged = {
        ...a,
        ...b
      };
      for (const key of [
        ...Object.getOwnPropertyNames(merged),
        ...Object.getOwnPropertySymbols(merged)
      ]) {
        if (!compare(a && a[key], b && b[key])) {
          return false;
        }
        if (key in a && a[key] !== void 0 && !(key in b) || key in b && b[key] !== void 0 && !(key in a)) {
          return false;
        }
      }
      if (a instanceof WeakRef || b instanceof WeakRef) {
        if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
        return compare(a.deref(), b.deref());
      }
      return true;
    }
    return false;
  }, "compare"))(c, d);
}
__name(equal, "equal");

// ../../../node_modules/@std/expect/_extend.js
var extendMatchers = {};
function getExtendMatchers() {
  return extendMatchers;
}
__name(getExtendMatchers, "getExtendMatchers");
function setExtendMatchers(newExtendMatchers) {
  extendMatchers = {
    ...extendMatchers,
    ...newExtendMatchers
  };
}
__name(setExtendMatchers, "setExtendMatchers");

// ../../../node_modules/@jsr/std__internal/format.js
function format(v) {
  const { Deno: Deno2 } = globalThis;
  return typeof Deno2?.inspect === "function" ? Deno2.inspect(v, {
    depth: Infinity,
    sorted: true,
    trailingComma: true,
    compact: false,
    iterableLimit: Infinity,
    // getters should be true in assertEquals.
    getters: true,
    strAbbreviateSize: Infinity
  }) : `"${String(v).replace(/(?=["\\])/g, "\\")}"`;
}
__name(format, "format");

// ../../../node_modules/@jsr/std__assert/not_strict_equals.js
function assertNotStrictEquals(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    return;
  }
  const msgSuffix = msg ? `: ${msg}` : ".";
  throw new AssertionError(`Expected "actual" to not be strictly equal to: ${format(actual)}${msgSuffix}
`);
}
__name(assertNotStrictEquals, "assertNotStrictEquals");

// ../../../node_modules/@jsr/std__internal/styles.js
var { Deno } = globalThis;
var noColor = typeof Deno?.noColor === "boolean" ? Deno.noColor : false;
var enabled = !noColor;
function code(open, close) {
  return {
    open: `\x1B[${open.join(";")}m`,
    close: `\x1B[${close}m`,
    regexp: new RegExp(`\\x1b\\[${close}m`, "g")
  };
}
__name(code, "code");
function run(str, code2) {
  return enabled ? `${code2.open}${str.replace(code2.regexp, code2.open)}${code2.close}` : str;
}
__name(run, "run");
function bold(str) {
  return run(str, code([
    1
  ], 22));
}
__name(bold, "bold");
function red(str) {
  return run(str, code([
    31
  ], 39));
}
__name(red, "red");
function green(str) {
  return run(str, code([
    32
  ], 39));
}
__name(green, "green");
function white(str) {
  return run(str, code([
    37
  ], 39));
}
__name(white, "white");
function gray(str) {
  return brightBlack(str);
}
__name(gray, "gray");
function brightBlack(str) {
  return run(str, code([
    90
  ], 39));
}
__name(brightBlack, "brightBlack");
function bgRed(str) {
  return run(str, code([
    41
  ], 49));
}
__name(bgRed, "bgRed");
function bgGreen(str) {
  return run(str, code([
    42
  ], 49));
}
__name(bgGreen, "bgGreen");
var ANSI_PATTERN = new RegExp([
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TXZcf-nq-uy=><~]))"
].join("|"), "g");
function stripAnsiCode(string) {
  return string.replace(ANSI_PATTERN, "");
}
__name(stripAnsiCode, "stripAnsiCode");

// ../../../node_modules/@jsr/std__internal/build_message.js
function createColor(diffType, background = false) {
  switch (diffType) {
    case "added":
      return (s) => background ? bgGreen(white(s)) : green(bold(s));
    case "removed":
      return (s) => background ? bgRed(white(s)) : red(bold(s));
    default:
      return white;
  }
}
__name(createColor, "createColor");
function createSign(diffType) {
  switch (diffType) {
    case "added":
      return "+   ";
    case "removed":
      return "-   ";
    default:
      return "    ";
  }
}
__name(createSign, "createSign");
function buildMessage(diffResult, options = {}) {
  const { stringDiff = false } = options;
  const messages = [
    "",
    "",
    `    ${gray(bold("[Diff]"))} ${red(bold("Actual"))} / ${green(bold("Expected"))}`,
    "",
    ""
  ];
  const diffMessages = diffResult.map((result) => {
    const color = createColor(result.type);
    const line = result.details?.map((detail) => detail.type !== "common" ? createColor(detail.type, true)(detail.value) : detail.value).join("") ?? result.value;
    return color(`${createSign(result.type)}${line}`);
  });
  messages.push(...stringDiff ? [
    diffMessages.join("")
  ] : diffMessages, "");
  return messages;
}
__name(buildMessage, "buildMessage");

// ../../../node_modules/@jsr/std__internal/diff.js
var REMOVED = 1;
var COMMON = 2;
var ADDED = 3;
function createCommon(A, B) {
  const common = [];
  if (A.length === 0 || B.length === 0) return [];
  for (let i = 0; i < Math.min(A.length, B.length); i += 1) {
    const a = A[i];
    const b = B[i];
    if (a !== void 0 && a === b) {
      common.push(a);
    } else {
      return common;
    }
  }
  return common;
}
__name(createCommon, "createCommon");
function assertFp(value) {
  if (value == null || typeof value !== "object" || typeof value?.y !== "number" || typeof value?.id !== "number") {
    throw new Error(`Unexpected value, expected 'FarthestPoint': received ${typeof value}`);
  }
}
__name(assertFp, "assertFp");
function backTrace(A, B, current, swapped, routes, diffTypesPtrOffset) {
  const M = A.length;
  const N = B.length;
  const result = [];
  let a = M - 1;
  let b = N - 1;
  let j = routes[current.id];
  let type = routes[current.id + diffTypesPtrOffset];
  while (true) {
    if (!j && !type) break;
    const prev = j;
    if (type === REMOVED) {
      result.unshift({
        type: swapped ? "removed" : "added",
        value: B[b]
      });
      b -= 1;
    } else if (type === ADDED) {
      result.unshift({
        type: swapped ? "added" : "removed",
        value: A[a]
      });
      a -= 1;
    } else {
      result.unshift({
        type: "common",
        value: A[a]
      });
      a -= 1;
      b -= 1;
    }
    j = routes[prev];
    type = routes[prev + diffTypesPtrOffset];
  }
  return result;
}
__name(backTrace, "backTrace");
function createFp(k, M, routes, diffTypesPtrOffset, ptr, slide, down) {
  if (slide && slide.y === -1 && down && down.y === -1) {
    return {
      y: 0,
      id: 0
    };
  }
  const isAdding = down?.y === -1 || k === M || (slide?.y || 0) > (down?.y || 0) + 1;
  if (slide && isAdding) {
    const prev = slide.id;
    ptr++;
    routes[ptr] = prev;
    routes[ptr + diffTypesPtrOffset] = ADDED;
    return {
      y: slide.y,
      id: ptr
    };
  }
  if (down && !isAdding) {
    const prev = down.id;
    ptr++;
    routes[ptr] = prev;
    routes[ptr + diffTypesPtrOffset] = REMOVED;
    return {
      y: down.y + 1,
      id: ptr
    };
  }
  throw new Error("Unexpected missing FarthestPoint");
}
__name(createFp, "createFp");
function diff(A, B) {
  const prefixCommon = createCommon(A, B);
  A = A.slice(prefixCommon.length);
  B = B.slice(prefixCommon.length);
  const swapped = B.length > A.length;
  [A, B] = swapped ? [
    B,
    A
  ] : [
    A,
    B
  ];
  const M = A.length;
  const N = B.length;
  if (!M && !N && !prefixCommon.length) return [];
  if (!N) {
    return [
      ...prefixCommon.map((value) => ({
        type: "common",
        value
      })),
      ...A.map((value) => ({
        type: swapped ? "added" : "removed",
        value
      }))
    ];
  }
  const offset = N;
  const delta = M - N;
  const length = M + N + 1;
  const fp = Array.from({
    length
  }, () => ({
    y: -1,
    id: -1
  }));
  const routes = new Uint32Array((M * N + length + 1) * 2);
  const diffTypesPtrOffset = routes.length / 2;
  let ptr = 0;
  function snake(k, A2, B2, slide, down) {
    const M2 = A2.length;
    const N2 = B2.length;
    const fp2 = createFp(k, M2, routes, diffTypesPtrOffset, ptr, slide, down);
    ptr = fp2.id;
    while (fp2.y + k < M2 && fp2.y < N2 && A2[fp2.y + k] === B2[fp2.y]) {
      const prev = fp2.id;
      ptr++;
      fp2.id = ptr;
      fp2.y += 1;
      routes[ptr] = prev;
      routes[ptr + diffTypesPtrOffset] = COMMON;
    }
    return fp2;
  }
  __name(snake, "snake");
  let currentFp = fp[delta + offset];
  assertFp(currentFp);
  let p = -1;
  while (currentFp.y < N) {
    p = p + 1;
    for (let k = -p; k < delta; ++k) {
      const index2 = k + offset;
      fp[index2] = snake(k, A, B, fp[index2 - 1], fp[index2 + 1]);
    }
    for (let k = delta + p; k > delta; --k) {
      const index2 = k + offset;
      fp[index2] = snake(k, A, B, fp[index2 - 1], fp[index2 + 1]);
    }
    const index = delta + offset;
    fp[delta + offset] = snake(delta, A, B, fp[index - 1], fp[index + 1]);
    currentFp = fp[delta + offset];
    assertFp(currentFp);
  }
  return [
    ...prefixCommon.map((value) => ({
      type: "common",
      value
    })),
    ...backTrace(A, B, currentFp, swapped, routes, diffTypesPtrOffset)
  ];
}
__name(diff, "diff");

// ../../../node_modules/@jsr/std__internal/diff_str.js
function unescape(string) {
  return string.replaceAll("\b", "\\b").replaceAll("\f", "\\f").replaceAll("	", "\\t").replaceAll("\v", "\\v").replaceAll(/\r\n|\r|\n/g, (str) => str === "\r" ? "\\r" : str === "\n" ? "\\n\n" : "\\r\\n\r\n");
}
__name(unescape, "unescape");
var WHITESPACE_SYMBOLS = /([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/;
function tokenize(string, wordDiff = false) {
  if (wordDiff) {
    return string.split(WHITESPACE_SYMBOLS).filter((token) => token);
  }
  const tokens = [];
  const lines = string.split(/(\n|\r\n)/).filter((line) => line);
  for (const [i, line] of lines.entries()) {
    if (i % 2) {
      tokens[tokens.length - 1] += line;
    } else {
      tokens.push(line);
    }
  }
  return tokens;
}
__name(tokenize, "tokenize");
function createDetails(line, tokens) {
  return tokens.filter(({ type }) => type === line.type || type === "common").map((result, i, t) => {
    const token = t[i - 1];
    if (result.type === "common" && token && token.type === t[i + 1]?.type && /\s+/.test(result.value)) {
      return {
        ...result,
        type: token.type
      };
    }
    return result;
  });
}
__name(createDetails, "createDetails");
var NON_WHITESPACE_REGEXP = /\S/;
function diffStr(A, B) {
  const diffResult = diff(tokenize(`${unescape(A)}
`), tokenize(`${unescape(B)}
`));
  const added = [];
  const removed = [];
  for (const result of diffResult) {
    if (result.type === "added") {
      added.push(result);
    }
    if (result.type === "removed") {
      removed.push(result);
    }
  }
  const hasMoreRemovedLines = added.length < removed.length;
  const aLines = hasMoreRemovedLines ? added : removed;
  const bLines = hasMoreRemovedLines ? removed : added;
  for (const a of aLines) {
    let tokens = [];
    let b;
    while (bLines.length) {
      b = bLines.shift();
      const tokenized = [
        tokenize(a.value, true),
        tokenize(b.value, true)
      ];
      if (hasMoreRemovedLines) tokenized.reverse();
      tokens = diff(tokenized[0], tokenized[1]);
      if (tokens.some(({ type, value }) => type === "common" && NON_WHITESPACE_REGEXP.test(value))) {
        break;
      }
    }
    a.details = createDetails(a, tokens);
    if (b) {
      b.details = createDetails(b, tokens);
    }
  }
  return diffResult;
}
__name(diffStr, "diffStr");

// ../../../node_modules/@jsr/std__assert/strict_equals.js
function assertStrictEquals(actual, expected, msg) {
  if (Object.is(actual, expected)) {
    return;
  }
  const msgSuffix = msg ? `: ${msg}` : ".";
  let message;
  const actualString = format(actual);
  const expectedString = format(expected);
  if (actualString === expectedString) {
    const withOffset = actualString.split("\n").map((l3) => `    ${l3}`).join("\n");
    message = `Values have the same structure but are not reference-equal${msgSuffix}

${red(withOffset)}
`;
  } else {
    const stringDiff = typeof actual === "string" && typeof expected === "string";
    const diffResult = stringDiff ? diffStr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
    const diffMsg = buildMessage(diffResult, {
      stringDiff
    }).join("\n");
    message = `Values are not strictly equal${msgSuffix}
${diffMsg}`;
  }
  throw new AssertionError(message);
}
__name(assertStrictEquals, "assertStrictEquals");

// ../../../node_modules/@jsr/std__assert/instance_of.js
function assertInstanceOf(actual, expectedType, msg = "") {
  if (actual instanceof expectedType) return;
  const msgSuffix = msg ? `: ${msg}` : ".";
  const expectedTypeStr = expectedType.name;
  let actualTypeStr = "";
  if (actual === null) {
    actualTypeStr = "null";
  } else if (actual === void 0) {
    actualTypeStr = "undefined";
  } else if (typeof actual === "object") {
    actualTypeStr = actual.constructor?.name ?? "Object";
  } else {
    actualTypeStr = typeof actual;
  }
  if (expectedTypeStr === actualTypeStr) {
    msg = `Expected object to be an instance of "${expectedTypeStr}"${msgSuffix}`;
  } else if (actualTypeStr === "function") {
    msg = `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object${msgSuffix}`;
  } else {
    msg = `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}"${msgSuffix}`;
  }
  throw new AssertionError(msg);
}
__name(assertInstanceOf, "assertInstanceOf");

// ../../../node_modules/@jsr/std__assert/is_error.js
function assertIsError(error, ErrorClass, msgMatches, msg) {
  const msgSuffix = msg ? `: ${msg}` : ".";
  if (!(error instanceof Error)) {
    throw new AssertionError(`Expected "error" to be an Error object${msgSuffix}}`);
  }
  if (ErrorClass && !(error instanceof ErrorClass)) {
    msg = `Expected error to be instance of "${ErrorClass.name}", but was "${error?.constructor?.name}"${msgSuffix}`;
    throw new AssertionError(msg);
  }
  let msgCheck;
  if (typeof msgMatches === "string") {
    msgCheck = stripAnsiCode(error.message).includes(stripAnsiCode(msgMatches));
  }
  if (msgMatches instanceof RegExp) {
    msgCheck = msgMatches.test(stripAnsiCode(error.message));
  }
  if (msgMatches && !msgCheck) {
    msg = `Expected error message to include ${msgMatches instanceof RegExp ? msgMatches.toString() : JSON.stringify(msgMatches)}, but got ${JSON.stringify(error?.message)}${msgSuffix}`;
    throw new AssertionError(msg);
  }
}
__name(assertIsError, "assertIsError");

// ../../../node_modules/@jsr/std__assert/false.js
function assertFalse(expr, msg = "") {
  if (expr) {
    throw new AssertionError(msg);
  }
}
__name(assertFalse, "assertFalse");

// ../../../node_modules/@jsr/std__assert/not_instance_of.js
function assertNotInstanceOf(actual, unexpectedType, msg) {
  const msgSuffix = msg ? `: ${msg}` : ".";
  msg = `Expected object to not be an instance of "${typeof unexpectedType}"${msgSuffix}`;
  assertFalse(actual instanceof unexpectedType, msg);
}
__name(assertNotInstanceOf, "assertNotInstanceOf");

// ../../../node_modules/@jsr/std__assert/match.js
function assertMatch(actual, expected, msg) {
  if (expected.test(actual)) return;
  const msgSuffix = msg ? `: ${msg}` : ".";
  msg = `Expected actual: "${actual}" to match: "${expected}"${msgSuffix}`;
  throw new AssertionError(msg);
}
__name(assertMatch, "assertMatch");

// ../../../node_modules/@jsr/std__assert/equal.js
function isKeyedCollection2(x) {
  return [
    Symbol.iterator,
    "size"
  ].every((k) => k in x);
}
__name(isKeyedCollection2, "isKeyedCollection");
function constructorsEqual2(a, b) {
  return a.constructor === b.constructor || a.constructor === Object && !b.constructor || !a.constructor && b.constructor === Object;
}
__name(constructorsEqual2, "constructorsEqual");
function equal2(c, d) {
  const seen = /* @__PURE__ */ new Map();
  return (/* @__PURE__ */ __name(function compare(a, b) {
    if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
      return String(a) === String(b);
    }
    if (a instanceof Date && b instanceof Date) {
      const aTime = a.getTime();
      const bTime = b.getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return true;
      }
      return aTime === bTime;
    }
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b) || a === b;
    }
    if (Object.is(a, b)) {
      return true;
    }
    if (a && typeof a === "object" && b && typeof b === "object") {
      if (a && b && !constructorsEqual2(a, b)) {
        return false;
      }
      if (a instanceof WeakMap || b instanceof WeakMap) {
        if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
        throw new TypeError("cannot compare WeakMap instances");
      }
      if (a instanceof WeakSet || b instanceof WeakSet) {
        if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
        throw new TypeError("cannot compare WeakSet instances");
      }
      if (a instanceof WeakRef || b instanceof WeakRef) {
        if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
        return compare(a.deref(), b.deref());
      }
      if (seen.get(a) === b) {
        return true;
      }
      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }
      seen.set(a, b);
      if (isKeyedCollection2(a) && isKeyedCollection2(b)) {
        if (a.size !== b.size) {
          return false;
        }
        let unmatchedEntries = a.size;
        for (const [aKey, aValue] of a.entries()) {
          for (const [bKey, bValue] of b.entries()) {
            if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
              unmatchedEntries--;
              break;
            }
          }
        }
        return unmatchedEntries === 0;
      }
      const merged = {
        ...a,
        ...b
      };
      for (const key of [
        ...Object.getOwnPropertyNames(merged),
        ...Object.getOwnPropertySymbols(merged)
      ]) {
        if (!compare(a && a[key], b && b[key])) {
          return false;
        }
        if (key in a && !(key in b) || key in b && !(key in a)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }, "compare"))(c, d);
}
__name(equal2, "equal");

// ../../../node_modules/@jsr/std__assert/equals.js
function assertEquals(actual, expected, msg) {
  if (equal2(actual, expected)) {
    return;
  }
  const msgSuffix = msg ? `: ${msg}` : ".";
  let message = `Values are not equal${msgSuffix}`;
  const actualString = format(actual);
  const expectedString = format(expected);
  const stringDiff = typeof actual === "string" && typeof expected === "string";
  const diffResult = stringDiff ? diffStr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
  const diffMsg = buildMessage(diffResult, {
    stringDiff
  }).join("\n");
  message = `${message}
${diffMsg}`;
  throw new AssertionError(message);
}
__name(assertEquals, "assertEquals");

// ../../../node_modules/@jsr/std__assert/object_match.js
function assertObjectMatch(actual, expected, msg) {
  return assertEquals(
    // get the intersection of "actual" and "expected"
    // side effect: all the instances' constructor field is "Object" now.
    filter(actual, expected),
    // set (nested) instances' constructor field to be "Object" without changing expected value.
    // see https://github.com/denoland/deno_std/pull/1419
    filter(expected, expected),
    msg
  );
}
__name(assertObjectMatch, "assertObjectMatch");
function isObject(val) {
  return typeof val === "object" && val !== null;
}
__name(isObject, "isObject");
function filter(a, b) {
  const seen = /* @__PURE__ */ new WeakMap();
  return filterObject(a, b);
  function filterObject(a2, b2) {
    if (seen.has(a2) && seen.get(a2) === b2) {
      return a2;
    }
    try {
      seen.set(a2, b2);
    } catch (err) {
      if (err instanceof TypeError) {
        throw new TypeError(`Cannot assertObjectMatch ${a2 === null ? null : `type ${typeof a2}`}`);
      }
    }
    const filtered = {};
    const keysA = Reflect.ownKeys(a2);
    const keysB = Reflect.ownKeys(b2);
    const entries2 = keysA.filter((key) => keysB.includes(key)).map((key) => [
      key,
      a2[key]
    ]);
    if (keysA.length && keysB.length && !entries2.length) {
      for (const key of keysA) {
        filtered[key] = a2[key];
      }
      return filtered;
    }
    for (const [key, value] of entries2) {
      if (value instanceof RegExp) {
        filtered[key] = value;
        continue;
      }
      const subset = b2[key];
      if (Array.isArray(value) && Array.isArray(subset)) {
        filtered[key] = filterArray(value, subset);
        continue;
      }
      if (isObject(value) && isObject(subset)) {
        if (value instanceof Map && subset instanceof Map) {
          filtered[key] = new Map([
            ...value
          ].filter(([k]) => subset.has(k)).map(([k, v]) => {
            const v2 = subset.get(k);
            if (isObject(v) && isObject(v2)) {
              return [
                k,
                filterObject(v, v2)
              ];
            }
            return [
              k,
              v
            ];
          }));
          continue;
        }
        if (value instanceof Set && subset instanceof Set) {
          filtered[key] = value.intersection(subset);
          continue;
        }
        filtered[key] = filterObject(value, subset);
        continue;
      }
      filtered[key] = value;
    }
    return filtered;
  }
  __name(filterObject, "filterObject");
  function filterArray(a2, b2) {
    if (seen.has(a2) && seen.get(a2) === b2) {
      return a2;
    }
    seen.set(a2, b2);
    const filtered = [];
    const count = Math.min(a2.length, b2.length);
    for (let i = 0; i < count; ++i) {
      const value = a2[i];
      const subset = b2[i];
      if (value instanceof RegExp) {
        filtered.push(value);
        continue;
      }
      if (Array.isArray(value) && Array.isArray(subset)) {
        filtered.push(filterArray(value, subset));
        continue;
      }
      if (isObject(value) && isObject(subset)) {
        if (value instanceof Map && subset instanceof Map) {
          const map = new Map([
            ...value
          ].filter(([k]) => subset.has(k)).map(([k, v]) => {
            const v2 = subset.get(k);
            if (isObject(v) && isObject(v2)) {
              return [
                k,
                filterObject(v, v2)
              ];
            }
            return [
              k,
              v
            ];
          }));
          filtered.push(map);
          continue;
        }
        if (value instanceof Set && subset instanceof Set) {
          filtered.push(value.intersection(subset));
          continue;
        }
        filtered.push(filterObject(value, subset));
        continue;
      }
      filtered.push(value);
    }
    return filtered;
  }
  __name(filterArray, "filterArray");
}
__name(filter, "filter");

// ../../../node_modules/@jsr/std__assert/not_match.js
function assertNotMatch(actual, expected, msg) {
  if (!expected.test(actual)) return;
  const msgSuffix = msg ? `: ${msg}` : ".";
  msg = `Expected actual: "${actual}" to not match: "${expected}"${msgSuffix}`;
  throw new AssertionError(msg);
}
__name(assertNotMatch, "assertNotMatch");

// ../../../node_modules/@std/expect/_build_message.js
function isString(value) {
  return typeof value === "string";
}
__name(isString, "isString");
function buildEqualErrorMessage(actual, expected, options) {
  const { formatter = format, msg } = options || {};
  const msgSuffix = msg ? `: ${msg}` : ".";
  const actualString = formatter(actual);
  const expectedString = formatter(expected);
  let message = `Values are not equal${msgSuffix}`;
  const stringDiff = isString(actual) && isString(expected);
  const diffResult = stringDiff ? diffStr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
  const diffMsg = buildMessage(diffResult, {
    stringDiff
  }).join("\n");
  message = `${message}
${diffMsg}`;
  return message;
}
__name(buildEqualErrorMessage, "buildEqualErrorMessage");
function buildNotEqualErrorMessage(actual, expected, options) {
  const { msg } = options || {};
  const actualString = String(actual);
  const expectedString = String(expected);
  const msgSuffix = msg ? `: ${msg}` : ".";
  return `Expected actual: ${actualString} not to be: ${expectedString}${msgSuffix}`;
}
__name(buildNotEqualErrorMessage, "buildNotEqualErrorMessage");

// ../../../node_modules/@std/expect/_assert_equals.js
function assertEquals2(actual, expected, options) {
  if (equal(actual, expected, options)) {
    return;
  }
  const message = buildEqualErrorMessage(actual, expected, options || {});
  throw new AssertionError(message);
}
__name(assertEquals2, "assertEquals");

// ../../../node_modules/@std/expect/_assert_not_equals.js
function assertNotEquals(actual, expected, options) {
  const { msg } = options || {};
  if (!equal(actual, expected, options)) {
    return;
  }
  const message = buildNotEqualErrorMessage(actual, expected, {
    msg
  });
  throw new AssertionError(message);
}
__name(assertNotEquals, "assertNotEquals");

// ../../../node_modules/@std/expect/_mock_util.js
var MOCK_SYMBOL = Symbol.for("@MOCK");
function getMockCalls(f) {
  const mockInfo = f[MOCK_SYMBOL];
  if (!mockInfo) {
    throw new Error("Received function must be a mock or spy function");
  }
  return [
    ...mockInfo.calls
  ];
}
__name(getMockCalls, "getMockCalls");

// ../../../node_modules/@std/expect/_inspect_args.js
function inspectArgs(args) {
  return args.map(inspectArg).join(", ");
}
__name(inspectArgs, "inspectArgs");
function inspectArg(arg) {
  const { Deno: Deno2 } = globalThis;
  return typeof Deno2 !== "undefined" && Deno2.inspect ? Deno2.inspect(arg) : String(arg);
}
__name(inspectArg, "inspectArg");

// ../../../node_modules/@std/expect/_utils.js
function buildEqualOptions(options) {
  const { customMessage, customTesters = [], strictCheck } = options || {};
  return {
    customTesters,
    msg: customMessage,
    strictCheck
  };
}
__name(buildEqualOptions, "buildEqualOptions");
function isPromiseLike(value) {
  if (value == null) {
    return false;
  } else {
    return typeof value.then === "function";
  }
}
__name(isPromiseLike, "isPromiseLike");
function hasIterator(object) {
  return !!(object != null && object[Symbol.iterator]);
}
__name(hasIterator, "hasIterator");
function isA(typeName, value) {
  return Object.prototype.toString.apply(value) === `[object ${typeName}]`;
}
__name(isA, "isA");
function isObject2(a) {
  return a !== null && typeof a === "object";
}
__name(isObject2, "isObject");
function entries(obj) {
  if (!isObject2(obj)) return [];
  return Object.getOwnPropertySymbols(obj).filter((key) => key !== Symbol.iterator).map((key) => [
    key,
    obj[key]
  ]).concat(Object.entries(obj));
}
__name(entries, "entries");
function iterableEquality(a, b, customTesters = [], aStack = [], bStack = []) {
  if (typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b) || !hasIterator(a) || !hasIterator(b)) {
    return void 0;
  }
  if (a.constructor !== b.constructor) {
    return false;
  }
  let length = aStack.length;
  while (length--) {
    if (aStack[length] === a) {
      return bStack[length] === b;
    }
  }
  aStack.push(a);
  bStack.push(b);
  const iterableEqualityWithStack = /* @__PURE__ */ __name((a2, b2) => iterableEquality(a2, b2, [
    ...filteredCustomTesters
  ], [
    ...aStack
  ], [
    ...bStack
  ]), "iterableEqualityWithStack");
  const filteredCustomTesters = [
    ...customTesters.filter((t) => t !== iterableEquality),
    iterableEqualityWithStack
  ];
  if (a.size !== void 0) {
    if (a.size !== b.size) {
      return false;
    } else if (isA("Set", a)) {
      let allFound = true;
      for (const aValue of a) {
        if (!b.has(aValue)) {
          let has = false;
          for (const bValue of b) {
            const isEqual = equal(aValue, bValue, {
              customTesters: filteredCustomTesters
            });
            if (isEqual === true) {
              has = true;
            }
          }
          if (has === false) {
            allFound = false;
            break;
          }
        }
      }
      aStack.pop();
      bStack.pop();
      return allFound;
    } else if (isA("Map", a)) {
      let allFound = true;
      for (const aEntry of a) {
        if (!b.has(aEntry[0]) || !equal(aEntry[1], b.get(aEntry[0]), {
          customTesters: filteredCustomTesters
        })) {
          let has = false;
          for (const bEntry of b) {
            const matchedKey = equal(aEntry[0], bEntry[0], {
              customTesters: filteredCustomTesters
            });
            let matchedValue = false;
            if (matchedKey === true) {
              matchedValue = equal(aEntry[1], bEntry[1], {
                customTesters: filteredCustomTesters
              });
            }
            if (matchedValue === true) {
              has = true;
            }
          }
          if (has === false) {
            allFound = false;
            break;
          }
        }
      }
      aStack.pop();
      bStack.pop();
      return allFound;
    }
  }
  const bIterator = b[Symbol.iterator]();
  for (const aValue of a) {
    const nextB = bIterator.next();
    if (nextB.done || !equal(aValue, nextB.value, {
      customTesters: filteredCustomTesters
    })) {
      return false;
    }
  }
  if (!bIterator.next().done) {
    return false;
  }
  const aEntries = entries(a);
  const bEntries = entries(b);
  if (!equal(aEntries, bEntries)) {
    return false;
  }
  aStack.pop();
  bStack.pop();
  return true;
}
__name(iterableEquality, "iterableEquality");

// ../../../node_modules/@std/expect/_matchers.js
function toBe(context, expect2) {
  if (context.isNot) {
    assertNotStrictEquals(context.value, expect2, context.customMessage);
  } else {
    assertStrictEquals(context.value, expect2, context.customMessage);
  }
}
__name(toBe, "toBe");
function toEqual(context, expected) {
  const v = context.value;
  const e = expected;
  const equalsOptions = buildEqualOptions({
    ...context,
    customTesters: [
      ...context.customTesters,
      iterableEquality
    ]
  });
  if (context.isNot) {
    assertNotEquals(v, e, equalsOptions);
  } else {
    assertEquals2(v, e, equalsOptions);
  }
}
__name(toEqual, "toEqual");
function toStrictEqual(context, expected) {
  const equalsOptions = buildEqualOptions({
    ...context,
    strictCheck: true,
    customTesters: [
      ...context.customTesters,
      iterableEquality
    ]
  });
  if (context.isNot) {
    assertNotEquals(context.value, expected, equalsOptions);
  } else {
    assertEquals2(context.value, expected, equalsOptions);
  }
}
__name(toStrictEqual, "toStrictEqual");
function toBeCloseTo(context, expected, numDigits = 2) {
  if (numDigits < 0) {
    throw new Error("toBeCloseTo second argument must be a non-negative integer. Got " + numDigits);
  }
  const tolerance = 0.5 * Math.pow(10, -numDigits);
  const value = Number(context.value);
  const pass = Math.abs(expected - value) < tolerance;
  if (context.isNot) {
    if (pass) {
      throw new AssertionError(`Expected the value not to be close to ${expected} (using ${numDigits} digits), but it is`);
    }
  } else {
    if (!pass) {
      throw new AssertionError(`Expected the value (${value} to be close to ${expected} (using ${numDigits} digits), but it is not`);
    }
  }
}
__name(toBeCloseTo, "toBeCloseTo");
function toBeDefined(context) {
  if (context.isNot) {
    assertStrictEquals(context.value, void 0, context.customMessage);
  } else {
    assertNotStrictEquals(context.value, void 0, context.customMessage);
  }
}
__name(toBeDefined, "toBeDefined");
function toBeUndefined(context) {
  if (context.isNot) {
    assertNotStrictEquals(context.value, void 0, context.customMessage);
  } else {
    assertStrictEquals(context.value, void 0, context.customMessage);
  }
}
__name(toBeUndefined, "toBeUndefined");
function toBeFalsy(context) {
  const isFalsy = !context.value;
  if (context.isNot) {
    if (isFalsy) {
      throw new AssertionError(`Expected ${context.value} to NOT be falsy`);
    }
  } else {
    if (!isFalsy) {
      throw new AssertionError(`Expected ${context.value} to be falsy`);
    }
  }
}
__name(toBeFalsy, "toBeFalsy");
function toBeTruthy(context) {
  const isTruthy = !!context.value;
  if (context.isNot) {
    if (isTruthy) {
      throw new AssertionError(`Expected ${context.value} to NOT be truthy`);
    }
  } else {
    if (!isTruthy) {
      throw new AssertionError(`Expected ${context.value} to be truthy`);
    }
  }
}
__name(toBeTruthy, "toBeTruthy");
function toBeGreaterThanOrEqual(context, expected) {
  const isGreaterOrEqual = Number(context.value) >= Number(expected);
  if (context.isNot) {
    if (isGreaterOrEqual) {
      throw new AssertionError(`Expected ${context.value} to NOT be greater than or equal ${expected}`);
    }
  } else {
    if (!isGreaterOrEqual) {
      throw new AssertionError(`Expected ${context.value} to be greater than or equal ${expected}`);
    }
  }
}
__name(toBeGreaterThanOrEqual, "toBeGreaterThanOrEqual");
function toBeGreaterThan(context, expected) {
  const isGreater = Number(context.value) > Number(expected);
  if (context.isNot) {
    if (isGreater) {
      throw new AssertionError(`Expected ${context.value} to NOT be greater than ${expected}`);
    }
  } else {
    if (!isGreater) {
      throw new AssertionError(`Expected ${context.value} to be greater than ${expected}`);
    }
  }
}
__name(toBeGreaterThan, "toBeGreaterThan");
function toBeInstanceOf(context, expected) {
  if (context.isNot) {
    assertNotInstanceOf(context.value, expected);
  } else {
    assertInstanceOf(context.value, expected);
  }
}
__name(toBeInstanceOf, "toBeInstanceOf");
function toBeLessThanOrEqual(context, expected) {
  const isLower = Number(context.value) <= Number(expected);
  if (context.isNot) {
    if (isLower) {
      throw new AssertionError(`Expected ${context.value} to NOT be lower than or equal ${expected}`);
    }
  } else {
    if (!isLower) {
      throw new AssertionError(`Expected ${context.value} to be lower than or equal ${expected}`);
    }
  }
}
__name(toBeLessThanOrEqual, "toBeLessThanOrEqual");
function toBeLessThan(context, expected) {
  const isLower = Number(context.value) < Number(expected);
  if (context.isNot) {
    if (isLower) {
      throw new AssertionError(`Expected ${context.value} to NOT be lower than ${expected}`);
    }
  } else {
    if (!isLower) {
      throw new AssertionError(`Expected ${context.value} to be lower than ${expected}`);
    }
  }
}
__name(toBeLessThan, "toBeLessThan");
function toBeNaN(context) {
  const equalsOptions = buildEqualOptions(context);
  if (context.isNot) {
    assertNotEquals(isNaN(Number(context.value)), true, {
      ...equalsOptions,
      msg: equalsOptions.msg || `Expected ${context.value} to not be NaN`
    });
  } else {
    assertEquals2(isNaN(Number(context.value)), true, {
      ...equalsOptions,
      msg: equalsOptions.msg || `Expected ${context.value} to be NaN`
    });
  }
}
__name(toBeNaN, "toBeNaN");
function toBeNull(context) {
  if (context.isNot) {
    assertNotStrictEquals(context.value, null, context.customMessage || `Expected ${context.value} to not be null`);
  } else {
    assertStrictEquals(context.value, null, context.customMessage || `Expected ${context.value} to be null`);
  }
}
__name(toBeNull, "toBeNull");
function toHaveLength(context, expected) {
  const { value } = context;
  const maybeLength = value?.length;
  const hasLength = maybeLength === expected;
  if (context.isNot) {
    if (hasLength) {
      throw new AssertionError(`Expected value not to have length ${expected}, but it does`);
    }
  } else {
    if (!hasLength) {
      throw new AssertionError(`Expected value to have length ${expected}, but it does not. (The value has length ${maybeLength})`);
    }
  }
}
__name(toHaveLength, "toHaveLength");
function toHaveProperty(context, propName, v) {
  const { value } = context;
  let propPath = [];
  if (Array.isArray(propName)) {
    propPath = propName;
  } else {
    propPath = propName.split(".");
  }
  let current = value;
  while (true) {
    if (current === void 0 || current === null) {
      break;
    }
    if (propPath.length === 0) {
      break;
    }
    const prop = propPath.shift();
    current = current[prop];
  }
  let hasProperty;
  if (v) {
    hasProperty = current !== void 0 && propPath.length === 0 && equal(current, v, context);
  } else {
    hasProperty = current !== void 0 && propPath.length === 0;
  }
  let ofValue = "";
  if (v) {
    ofValue = ` of the value ${inspectArg(v)}`;
  }
  if (context.isNot) {
    if (hasProperty) {
      throw new AssertionError(`Expected the value not to have the property ${propPath.join(".")}${ofValue}, but it does.`);
    }
  } else {
    if (!hasProperty) {
      throw new AssertionError(`Expected the value to have the property ${propPath.join(".")}${ofValue}, but it does not.`);
    }
  }
}
__name(toHaveProperty, "toHaveProperty");
function toContain(context, expected) {
  const doesContain = context.value?.includes?.(expected);
  const fmtValue = format(context.value);
  const fmtExpected = format(expected);
  if (context.isNot) {
    if (doesContain) {
      throw new AssertionError(`The value ${fmtValue} contains the expected item ${fmtExpected}`);
    }
  } else {
    if (!doesContain) {
      throw new AssertionError(`The value ${fmtValue} doesn't contain the expected item ${fmtExpected}`);
    }
  }
}
__name(toContain, "toContain");
function toContainEqual(context, expected) {
  const { value } = context;
  assertIsIterable(value);
  let doesContain = false;
  for (const item of value) {
    if (equal(item, expected, context)) {
      doesContain = true;
      break;
    }
  }
  const prettyStringify = /* @__PURE__ */ __name((js) => JSON.stringify(js, null, "	").replace(/\"|\n|\t/g, "").slice(0, 100), "prettyStringify");
  const fmtValue = prettyStringify(context.value);
  const fmtExpected = prettyStringify(expected);
  if (context.isNot) {
    if (doesContain) {
      throw new AssertionError(`The value contains the expected item.
Value: ${fmtValue}
Expected: ${fmtExpected}`);
    }
  } else {
    if (!doesContain) {
      throw new AssertionError(`The value doesn't contain the expected item.
Value: ${fmtValue}
Expected: ${fmtExpected}`);
    }
  }
}
__name(toContainEqual, "toContainEqual");
function assertIsIterable(value) {
  if (value == null) {
    throw new AssertionError("The value is null or undefined");
  }
  if (typeof value[Symbol.iterator] !== "function") {
    throw new AssertionError("The value is not iterable");
  }
}
__name(assertIsIterable, "assertIsIterable");
function toMatch(context, expected) {
  if (context.isNot) {
    assertNotMatch(String(context.value), expected, context.customMessage);
  } else {
    assertMatch(String(context.value), expected, context.customMessage);
  }
}
__name(toMatch, "toMatch");
function toMatchObject(context, expected) {
  if (context.isNot) {
    let objectMatch = false;
    try {
      assertObjectMatch(
        // deno-lint-ignore no-explicit-any
        context.value,
        expected,
        context.customMessage
      );
      objectMatch = true;
      const actualString = format(context.value);
      const expectedString = format(expected);
      throw new AssertionError(`Expected ${actualString} to NOT match ${expectedString}`);
    } catch (e) {
      if (objectMatch) {
        throw e;
      }
      return;
    }
  } else {
    assertObjectMatch(
      // deno-lint-ignore no-explicit-any
      context.value,
      expected,
      context.customMessage
    );
  }
}
__name(toMatchObject, "toMatchObject");
function toHaveBeenCalled(context) {
  const calls = getMockCalls(context.value);
  const hasBeenCalled = calls.length > 0;
  if (context.isNot) {
    if (hasBeenCalled) {
      throw new AssertionError(`Expected mock function not to be called, but it was called ${calls.length} time(s)`);
    }
  } else {
    if (!hasBeenCalled) {
      throw new AssertionError(`Expected mock function to be called, but it was not called`);
    }
  }
}
__name(toHaveBeenCalled, "toHaveBeenCalled");
function toHaveBeenCalledTimes(context, expected) {
  const calls = getMockCalls(context.value);
  if (context.isNot) {
    if (calls.length === expected) {
      throw new AssertionError(`Expected mock function not to be called ${expected} time(s), but it was`);
    }
  } else {
    if (calls.length !== expected) {
      throw new AssertionError(`Expected mock function to be called ${expected} time(s), but it was called ${calls.length} time(s)`);
    }
  }
}
__name(toHaveBeenCalledTimes, "toHaveBeenCalledTimes");
function toHaveBeenCalledWith(context, ...expected) {
  const calls = getMockCalls(context.value);
  const hasBeenCalled = calls.some((call) => equal(call.args, expected));
  if (context.isNot) {
    if (hasBeenCalled) {
      throw new AssertionError(`Expected mock function not to be called with ${inspectArgs(expected)}, but it was`);
    }
  } else {
    if (!hasBeenCalled) {
      let otherCalls = "";
      if (calls.length > 0) {
        otherCalls = `
  Other calls:
     ${calls.map((call) => inspectArgs(call.args)).join("\n    ")}`;
      }
      throw new AssertionError(`Expected mock function to be called with ${inspectArgs(expected)}, but it was not.${otherCalls}`);
    }
  }
}
__name(toHaveBeenCalledWith, "toHaveBeenCalledWith");
function toHaveBeenLastCalledWith(context, ...expected) {
  const calls = getMockCalls(context.value);
  const hasBeenCalled = calls.length > 0 && equal(calls.at(-1)?.args, expected);
  if (context.isNot) {
    if (hasBeenCalled) {
      throw new AssertionError(`Expected mock function not to be last called with ${inspectArgs(expected)}, but it was`);
    }
  } else {
    if (!hasBeenCalled) {
      const lastCall = calls.at(-1);
      if (!lastCall) {
        throw new AssertionError(`Expected mock function to be last called with ${inspectArgs(expected)}, but it was not.`);
      } else {
        throw new AssertionError(`Expected mock function to be last called with ${inspectArgs(expected)}, but it was last called with ${inspectArgs(lastCall.args)}.`);
      }
    }
  }
}
__name(toHaveBeenLastCalledWith, "toHaveBeenLastCalledWith");
function toHaveBeenNthCalledWith(context, nth, ...expected) {
  if (nth < 1) {
    throw new Error(`nth must be greater than 0. ${nth} was given.`);
  }
  const calls = getMockCalls(context.value);
  const callIndex = nth - 1;
  const hasBeenCalled = calls.length > callIndex && equal(calls[callIndex]?.args, expected);
  if (context.isNot) {
    if (hasBeenCalled) {
      throw new AssertionError(`Expected the n-th call (n=${nth}) of mock function is not with ${inspectArgs(expected)}, but it was`);
    }
  } else {
    if (!hasBeenCalled) {
      const nthCall = calls[callIndex];
      if (!nthCall) {
        throw new AssertionError(`Expected the n-th call (n=${nth}) of mock function is with ${inspectArgs(expected)}, but the n-th call does not exist.`);
      } else {
        throw new AssertionError(`Expected the n-th call (n=${nth}) of mock function is with ${inspectArgs(expected)}, but it was with ${inspectArgs(nthCall.args)}.`);
      }
    }
  }
}
__name(toHaveBeenNthCalledWith, "toHaveBeenNthCalledWith");
function toHaveReturned(context) {
  const calls = getMockCalls(context.value);
  const returned = calls.filter((call) => call.returns);
  if (context.isNot) {
    if (returned.length > 0) {
      throw new AssertionError(`Expected the mock function to not have returned, but it returned ${returned.length} times`);
    }
  } else {
    if (returned.length === 0) {
      throw new AssertionError(`Expected the mock function to have returned, but it did not return`);
    }
  }
}
__name(toHaveReturned, "toHaveReturned");
function toHaveReturnedTimes(context, expected) {
  const calls = getMockCalls(context.value);
  const returned = calls.filter((call) => call.returns);
  if (context.isNot) {
    if (returned.length === expected) {
      throw new AssertionError(`Expected the mock function to not have returned ${expected} times, but it returned ${returned.length} times`);
    }
  } else {
    if (returned.length !== expected) {
      throw new AssertionError(`Expected the mock function to have returned ${expected} times, but it returned ${returned.length} times`);
    }
  }
}
__name(toHaveReturnedTimes, "toHaveReturnedTimes");
function toHaveReturnedWith(context, expected) {
  const calls = getMockCalls(context.value);
  const returned = calls.filter((call) => call.returns);
  const returnedWithExpected = returned.some((call) => equal(call.returned, expected));
  if (context.isNot) {
    if (returnedWithExpected) {
      throw new AssertionError(`Expected the mock function to not have returned with ${inspectArg(expected)}, but it did`);
    }
  } else {
    if (!returnedWithExpected) {
      throw new AssertionError(`Expected the mock function to have returned with ${inspectArg(expected)}, but it did not`);
    }
  }
}
__name(toHaveReturnedWith, "toHaveReturnedWith");
function toHaveLastReturnedWith(context, expected) {
  const calls = getMockCalls(context.value);
  const returned = calls.filter((call) => call.returns);
  const lastReturnedWithExpected = returned.length > 0 && equal(returned.at(-1)?.returned, expected);
  if (context.isNot) {
    if (lastReturnedWithExpected) {
      throw new AssertionError(`Expected the mock function to not have last returned with ${inspectArg(expected)}, but it did`);
    }
  } else {
    if (!lastReturnedWithExpected) {
      throw new AssertionError(`Expected the mock function to have last returned with ${inspectArg(expected)}, but it did not`);
    }
  }
}
__name(toHaveLastReturnedWith, "toHaveLastReturnedWith");
function toHaveNthReturnedWith(context, nth, expected) {
  if (nth < 1) {
    throw new Error(`nth(${nth}) must be greater than 0`);
  }
  const calls = getMockCalls(context.value);
  const returned = calls.filter((call) => call.returns);
  const returnIndex = nth - 1;
  const maybeNthReturned = returned[returnIndex];
  const nthReturnedWithExpected = maybeNthReturned && equal(maybeNthReturned.returned, expected);
  if (context.isNot) {
    if (nthReturnedWithExpected) {
      throw new AssertionError(`Expected the mock function to not have n-th (n=${nth}) returned with ${inspectArg(expected)}, but it did`);
    }
  } else {
    if (!nthReturnedWithExpected) {
      throw new AssertionError(`Expected the mock function to have n-th (n=${nth}) returned with ${inspectArg(expected)}, but it did not`);
    }
  }
}
__name(toHaveNthReturnedWith, "toHaveNthReturnedWith");
function toThrow(context, expected) {
  if (typeof context.value === "function") {
    try {
      context.value = context.value();
    } catch (err) {
      context.value = err;
    }
  }
  let expectClass = void 0;
  let expectMessage = void 0;
  if (expected instanceof Error) {
    expectClass = expected.constructor;
    expectMessage = expected.message;
  }
  if (expected instanceof Function) {
    expectClass = expected;
  }
  if (typeof expected === "string" || expected instanceof RegExp) {
    expectMessage = expected;
  }
  if (context.isNot) {
    let isError2 = false;
    try {
      assertIsError(context.value, expectClass, expectMessage, context.customMessage);
      isError2 = true;
      throw new AssertionError(`Expected to NOT throw ${expected}`);
    } catch (e) {
      if (isError2) {
        throw e;
      }
      return;
    }
  }
  return assertIsError(context.value, expectClass, expectMessage, context.customMessage);
}
__name(toThrow, "toThrow");

// ../../../node_modules/@std/expect/expect.js
var matchers = {
  lastCalledWith: toHaveBeenLastCalledWith,
  lastReturnedWith: toHaveLastReturnedWith,
  nthCalledWith: toHaveBeenNthCalledWith,
  nthReturnedWith: toHaveNthReturnedWith,
  toBeCalled: toHaveBeenCalled,
  toBeCalledTimes: toHaveBeenCalledTimes,
  toBeCalledWith: toHaveBeenCalledWith,
  toBeCloseTo,
  toBeDefined,
  toBeFalsy,
  toBeGreaterThanOrEqual,
  toBeGreaterThan,
  toBeInstanceOf,
  toBeLessThanOrEqual,
  toBeLessThan,
  toBeNaN,
  toBeNull,
  toBeTruthy,
  toBeUndefined,
  toBe,
  toContainEqual,
  toContain,
  toEqual,
  toHaveBeenCalledTimes,
  toHaveBeenCalledWith,
  toHaveBeenCalled,
  toHaveBeenLastCalledWith,
  toHaveBeenNthCalledWith,
  toHaveLength,
  toHaveLastReturnedWith,
  toHaveNthReturnedWith,
  toHaveProperty,
  toHaveReturnedTimes,
  toHaveReturnedWith,
  toHaveReturned,
  toMatchObject,
  toMatch,
  toReturn: toHaveReturned,
  toReturnTimes: toHaveReturnedTimes,
  toReturnWith: toHaveReturnedWith,
  toStrictEqual,
  toThrow
};
function expect(value, customMessage) {
  let isNot = false;
  let isPromised = false;
  const self = new Proxy({}, {
    get(_, name) {
      if (name === "not") {
        isNot = !isNot;
        return self;
      }
      if (name === "resolves") {
        if (!isPromiseLike(value)) {
          throw new AssertionError("Expected value must be PromiseLike");
        }
        isPromised = true;
        return self;
      }
      if (name === "rejects") {
        if (!isPromiseLike(value)) {
          throw new AssertionError("Expected value must be a PromiseLike");
        }
        value = value.then((value2) => {
          throw new AssertionError(`Promise did not reject: resolved to ${value2}`);
        }, (err) => err);
        isPromised = true;
        return self;
      }
      const extendMatchers2 = getExtendMatchers();
      const allMatchers = {
        ...extendMatchers2,
        ...matchers
      };
      const matcher = allMatchers[name];
      if (!matcher) {
        throw new TypeError(typeof name === "string" ? `matcher not found: ${name}` : "matcher not found");
      }
      return (...args) => {
        function applyMatcher(value2, args2) {
          const context = {
            value: value2,
            equal,
            isNot: false,
            customMessage,
            customTesters: getCustomEqualityTesters()
          };
          if (isNot) {
            context.isNot = true;
          }
          if (name in extendMatchers2) {
            const result = matcher(context, ...args2);
            if (context.isNot) {
              if (result.pass) {
                throw new AssertionError(result.message());
              }
            } else if (!result.pass) {
              throw new AssertionError(result.message());
            }
          } else {
            matcher(context, ...args2);
          }
        }
        __name(applyMatcher, "applyMatcher");
        return isPromised ? value.then((value2) => applyMatcher(value2, args)) : applyMatcher(value, args);
      };
    }
  });
  return self;
}
__name(expect, "expect");
expect.addEqualityTesters = addCustomEqualityTesters;
expect.extend = setExtendMatchers;
expect.anything = anything;
expect.any = any;
expect.arrayContaining = arrayContaining;
expect.closeTo = closeTo;
expect.stringContaining = stringContaining;
expect.stringMatching = stringMatching;

// src/boolean.equal.ts
import { getLogger } from "@logtape/logtape";

// src/arrayLike.is.ts
var isArray = Array.isArray;
// @__NO_SIDE_EFFECTS__
function isAsyncIterable(value) {
  return typeof value?.[Symbol.asyncIterator] === "function";
}
__name(isAsyncIterable, "isAsyncIterable");
// @__NO_SIDE_EFFECTS__
function isMap(value) {
  return Object.prototype.toString.call(value) === "[object Map]";
}
__name(isMap, "isMap");
// @__NO_SIDE_EFFECTS__
function isWeakMap(value) {
  return Object.prototype.toString.call(value) === "[object WeakMap]";
}
__name(isWeakMap, "isWeakMap");
// @__NO_SIDE_EFFECTS__
function isSet(value) {
  return Object.prototype.toString.call(value) === "[object Set]";
}
__name(isSet, "isSet");
// @__NO_SIDE_EFFECTS__
function isWeakSet(value) {
  return Object.prototype.toString.call(value) === "[object WeakSet]";
}
__name(isWeakSet, "isWeakSet");
// @__NO_SIDE_EFFECTS__
function isObject3(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
__name(isObject3, "isObject");
// @__NO_SIDE_EFFECTS__
function isAsyncGenerator(value) {
  return Object.prototype.toString.call(value) === "[object AsyncGenerator]";
}
__name(isAsyncGenerator, "isAsyncGenerator");
// @__NO_SIDE_EFFECTS__
function isGenerator(value) {
  return Object.prototype.toString.call(value) === "[object Generator]";
}
__name(isGenerator, "isGenerator");

// src/arrayLike.from.ts
// @__NO_SIDE_EFFECTS__
function arrayFrom(arrayLike, mapFn) {
  const arrayLikeArray = isArray(arrayLike) ? arrayLike : ((arrayLike2) => {
    const newArrayLikeArray = [];
    for (const element of arrayLike2) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike);
  if (!mapFn) {
    return arrayLikeArray;
  }
  const mappedArray = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    mappedArray.push(mapFn(element, index));
    index++;
  }
  return mappedArray;
}
__name(arrayFrom, "arrayFrom");

// src/promise.is.ts
// @__NO_SIDE_EFFECTS__
function isPromise(value) {
  return typeof value?.then === "function";
}
__name(isPromise, "isPromise");

// src/error.is.ts
// @__NO_SIDE_EFFECTS__
function isError(value) {
  return Object.prototype.toString.call(value) === "[object Error]";
}
__name(isError, "isError");

// src/numeric.is.ts
// @__NO_SIDE_EFFECTS__
function isObjectDate(value) {
  return Object.prototype.toString.call(value) === "[object Date]";
}
__name(isObjectDate, "isObjectDate");

// src/string.is.ts
// @__NO_SIDE_EFFECTS__
function isString2(value) {
  return typeof value === "string";
}
__name(isString2, "isString");
// @__NO_SIDE_EFFECTS__
function isRegexp(value) {
  return Object.prototype.toString.call(value) === "[object RegExp]";
}
__name(isRegexp, "isRegexp");

// src/boolean.equal.ts
var l = getLogger(["m", "boolean.equal"]);
// @__NO_SIDE_EFFECTS__
function isPrimitive(value) {
  if (Object.is(value, void 0)) {
    return true;
  }
  if (Object.is(value, null)) {
    return true;
  }
  if (typeof value === "boolean") {
    return true;
  }
  if (isString2(value)) {
    return true;
  }
  if (typeof value === "bigint" || Object.prototype.toString.call(value) === "[object BigInt]") {
    return true;
  }
  if (typeof value === "symbol") {
    return true;
  }
  if (typeof value === "number") {
    return true;
  }
  l.debug`value ${value} is not a primitive`;
  return false;
}
__name(isPrimitive, "isPrimitive");
// @__NO_SIDE_EFFECTS__
function equal3(a, b) {
  l.debug`a: ${String(a)}, b: ${String(b)}`;
  if (Object.is(a, b)) {
    return true;
  }
  l.debug`ref/primitive eq failed on a: ${String(a)}, b: ${String(b)}`;
  if (/* @__PURE__ */ isPrimitive(a) || /* @__PURE__ */ isPrimitive(b)) {
    l.debug`At least one of a: ${String(a)} and b: ${String(b)} is primitive`;
    return false;
  }
  l.debug`non-primitives a: ${a}, b: ${b}`;
  if (isPromise(a) || isPromise(b)) {
    throw new TypeError(`At least one of a: ${a} and b: ${b} is a thenable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
  }
  if (typeof a === "function") {
    if (typeof b !== "function") {
      l.info`Is it intentional trying to compare a function a: ${a} to not function b: ${b}?`;
      return false;
    }
    l.warn`cannot compare two functions accurately due to the inherent unpredictability of functions.
    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal
    The string representations of both functions are not normalized before comparison.
    Nor were the functions converted to there AST form.
    Therefore, this comparison has a high chance of giving a false negative or false positive.
    `;
    return `${a}` === `${b}`;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      l.info`Is it intentional trying to compare an array a: ${a} to not array b: ${b}?`;
      return false;
    }
    l.debug`arrays a: ${a} b: ${b}`;
    if (a.length !== b.length) {
      return false;
    }
    if (a.length === 0) {
      return true;
    }
    return a.every(
      (aValue, aIndex) => (
        // Have to do a recursion here because the two arrays might not just contain primitives.
        /* @__PURE__ */ equal3(aValue, b[aIndex])
      )
    );
  }
  if (typeof a === "object") {
    if (typeof b !== "object") {
      l.warn`b is not a primitive, not a Promise, not a function, not an array, not an object.
        What is b: ${b}?`;
      return false;
    }
    l.debug`objects a: ${a} b: ${b}`;
    const aPrototype = Object.prototype.toString.call(a);
    const bPrototype = Object.prototype.toString.call(b);
    if (isAsyncGenerator(a) || isAsyncGenerator(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncGenerator.
          We cannot handle comparing them in a sync function.
          Try equalAsync()`);
    }
    if (isAsyncIterable(a) || isAsyncIterable(b)) {
      throw new TypeError(`At least one of a: ${a} and b: ${b} is an AsyncIterable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
    }
    if (isObjectDate(a)) {
      if (!isObjectDate(b)) {
        l.info`Is it intentional trying to compare a Date a: ${a} to not a Date b: ${b}?`;
        return false;
      }
      l.debug`dates a: ${a} b: ${b}`;
      if (a.getTime() === b.getTime()) {
        return true;
      }
      return false;
    }
    if (aPrototype === "[object Boolean]") {
      l.warn`The use of Boolean() the object wrapper is greatly discouraged. Found a: ${a}`;
      if (bPrototype !== "[object Boolean]") {
        l.info`Is it intentional trying to compare a Boolean wrapped a: ${a} to not a Boolean wrapped b: ${b}?`;
        return false;
      }
      l.debug`Boolean wraps a: ${a} b: ${b}`;
      if (a.valueOf() === b.valueOf()) {
        return true;
      }
      return false;
    }
    if (isError(a)) {
      if (!isError(b)) {
        l.info`Is it intentional trying to compare a error a: ${a} to not error b: ${b}?`;
        return false;
      }
      l.debug`Errors a: ${a} b: ${b}`;
      if (a.message !== b.message) {
        return false;
      }
      if (a.name !== b.name) {
        l.info`Is it intentional,
          giving two errors of different classes a: ${a.name} b: ${b.name}
          the same message: ${a.message}?`;
        return false;
      }
      if (/* @__PURE__ */ equal3(a?.cause, b?.cause)) {
        return true;
      }
      return false;
    }
    if (isGenerator(a)) {
      if (!isGenerator(b)) {
        l.info`Is it intentional trying to compare a Generator a: ${a} to not a Generator b: ${b}?`;
        return false;
      }
      l.info`comparing two Generators would only succeed
        if both of them never takes any parameters.`;
      return /* @__PURE__ */ equal3(arrayFrom(a), arrayFrom(b));
    }
    if (isRegexp(a)) {
      if (!isRegexp(b)) {
        l.info`Is it intentional trying to compare a regex a: ${a} to not a regex b: ${b}?`;
        return false;
      }
      l.debug`regexps a: ${a} b: ${b}`;
      return `${a}` === `${b}`;
    }
    if (isMap(a)) {
      if (!isMap(b)) {
        l.info`Is it intentional trying to compare a map a: ${a} to not a map b: ${b}?`;
        return false;
      }
      l.debug`maps a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal3(arrayFrom(a), arrayFrom(b));
    }
    if (isSet(a)) {
      if (!isSet(b)) {
        l.info`Is it intentional trying to compare a set a: ${a} to not a set b: ${b}?`;
        return false;
      }
      l.debug`sets a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal3(arrayFrom(a), arrayFrom(b));
    }
    if (isWeakMap(a) || isWeakMap(b)) {
      throw new TypeError(`WeakMaps are not enumerable, therefore cannot be compared.`);
    }
    if (isWeakSet(a) || isWeakSet(b)) {
      throw new TypeError(`WeakSets are not enumerable, therefore cannot be compared.`);
    }
    if (isObject3(a)) {
      l.info`Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor`;
      if (!isObject3(b)) {
        l.info`Is it intentional trying to compare an object Object a: ${a} to not an object Object b: ${b}?`;
        return false;
      }
      l.debug`Objects a: ${a} b: ${b}`;
      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }
      return Object.keys(a).every((aKey) => /* @__PURE__ */ equal3(a[aKey], b[aKey]));
    }
    throw new TypeError(
      `The comparison of object types ${aPrototype} and ${bPrototype} have not been implemented.`
    );
  }
  throw new TypeError(
    `at least one of a and b are not primitives, not Promises, not functions, not arrays, not objects.
  What are they?
  a: ${a}
  b: ${b}`
  );
}
__name(equal3, "equal");

// src/boolean.equal.test.ts
import { configure } from "@logtape/logtape";

// src/logtape.ts
import {
  getConsoleSink,
  getFileSink,
  getLevelFilter,
  withFilter
} from "@logtape/logtape";
// @__NO_SIDE_EFFECTS__
function logtapeConfiguration(appName = "monochromatic") {
  return {
    sinks: {
      console: getConsoleSink(),
      consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter("info")),
      consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter("warning")),
      file: getFileSink(`${appName}.log`, {
        formatter(log) {
          return `${JSON.stringify(log, null, 2)}
`;
        }
      })
    },
    filters: {},
    loggers: [
      /* a is short for app, m is short for module, t is short for test
         Sorry, but terminal space is precious. */
      { category: ["a"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["t"], level: "debug", sinks: ["file", "consoleInfoPlus"] },
      { category: ["m"], level: "debug", sinks: ["file", "consoleWarnPlus"] },
      {
        category: ["esbuild-plugin"],
        level: "debug",
        sinks: ["file", "consoleWarnPlus"]
      },
      { category: ["logtape", "meta"], level: "warning", sinks: ["console"] }
    ]
  };
}
__name(logtapeConfiguration, "logtapeConfiguration");

// src/testing.ts
import { getLogger as getLogger2 } from "@logtape/logtape";
var testFileBasename = new URL(import.meta.url).pathname.split("/").at(-1);
var testedFileName = testFileBasename.endsWith(".test.js") ? testFileBasename.slice(0, -".test.js".length) : testFileBasename;
var l2 = getLogger2(["t", testedFileName]);
// @__NO_SIDE_EFFECTS__
async function suite(name, testOrSuites, options) {
  l2.debug`suite ${name} started: ${testOrSuites.length} tests or suites`;
  const result = await Promise.allSettled(testOrSuites);
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "todo")) {
      l2.info`suite ${name} finished: ${JSON.stringify(result)}`;
      return { name, todo: options.todo, result };
    }
  }
  const errored = result.find((settledResult) => settledResult.status === "rejected");
  if (errored) {
    throw new Error(`suite ${name} errored with result: ${JSON.stringify(result)}`, {
      cause: errored.reason
    });
  }
  l2.debug`suite ${name} finished: ${JSON.stringify(result)}`;
  return { name, result };
}
__name(suite, "suite");
// @__NO_SIDE_EFFECTS__
async function test(name, callback, options) {
  let timeLimit = 0;
  let took = 0;
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      l2.warn`${name} skipped: ${options.skip}`;
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "timeLimit")) {
      timeLimit = typeof options.timeLimit === "number" ? options.timeLimit : await (async () => {
        const beforeExecutingTimeLimitReferenceCallback = performance.now();
        try {
          await options.timeLimit();
        } catch (timeLimitFnError) {
          l2.info`timeLimit fn threw ${timeLimitFnError}
            If this is intentional, you can ignore this log.
            The test will continue,
            the time it takes would be compared to the time timeLimit fn executed until it errored.`;
        }
        const afterExecutingTimeLimitReferenceCallback = performance.now();
        return afterExecutingTimeLimitReferenceCallback - beforeExecutingTimeLimitReferenceCallback;
      })();
      l2.debug`${name} timeLimit: ${timeLimit}ms`;
    }
    if (Object.hasOwn(options, "todo")) {
      l2.info`${name} started: ${callback} with todo: ${options.todo}`;
      try {
        const beforeExecutingTestingCallback = performance.now();
        const result = await callback();
        const afterExecutingTestingCallback = performance.now();
        took = afterExecutingTestingCallback - beforeExecutingTestingCallback;
        l2.debug`${name} took: ${took}ms`;
        if (result !== void 0 && result !== null) {
          if (took > timeLimit) {
            const tooLongPercentage = 100 * (took - timeLimit) / timeLimit;
            l2.error`${name} with todo: ${options.todo} took: ${took}ms, ${took - timeLimit}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`;
            return {
              name,
              todo: options.todo,
              result,
              tooLongPercentage
            };
          }
          l2.warn`${name} with todo: ${options.todo} finished: ${result}`;
          return { name, todo: options.todo, result };
        }
        if (took > timeLimit) {
          const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
          l2.error`${name} with todo: ${options.todo} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long.`;
          return { name, todo: options.todo, tooLongPercentage };
        }
        l2.warn`${name} with todo: ${options.todo} finished`;
        return { name, todo: options.todo };
      } catch (e) {
        l2.error`${name} with todo: ${options.todo} errored: ${e}`;
        return { name, todo: options.todo, result: e };
      }
    }
  }
  l2.debug`${name} started: ${String(callback).slice(0, 64)}`;
  try {
    const result = await callback();
    if (took > timeLimit) {
      const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
      throw new RangeError(
        `${name} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`
      );
    }
    if (result !== void 0 && result !== null) {
      l2.info`${name} finished: ${result}`;
      return { name, result };
    }
    l2.debug`${name} finished`;
    return name;
  } catch (callbackError) {
    throw new Error(`${name}: ${String(callback)} errored`, { cause: callbackError });
  }
}
__name(test, "test");

// src/boolean.equal.test.ts
await configure(logtapeConfiguration());
suite("equal", [
  suite("primitive", [
    test("number", () => {
      expect(equal3(0, 0)).toStrictEqual(true);
    }),
    test("string", () => {
      expect(equal3("1", "1")).toStrictEqual(true);
    }),
    test("undefined", () => {
      expect(equal3(void 0, void 0)).toStrictEqual(true);
    }),
    test("NaN", () => {
      expect(equal3(Number.NaN, Number.NaN)).toStrictEqual(true);
    }),
    test("bigint", () => {
      expect(equal3(1n, 1n)).toStrictEqual(true);
    }),
    test("BigInt", () => {
      expect(equal3(BigInt(1), BigInt(1))).toStrictEqual(true);
    })
  ]),
  suite("object", [
    suite("Object", [
      test("empty", () => {
        expect(equal3({}, {})).toStrictEqual(true);
      }),
      test("one", () => {
        expect(equal3({ a: 0 }, { a: 0 })).toStrictEqual(true);
      }),
      test("unordered", () => {
        expect(equal3({ a: 0, b: 1 }, { b: 1, a: 0 })).toStrictEqual(true);
      }),
      test("hasArray", () => {
        expect(equal3({ a: [0, { c: [] }], b: 1 }, { a: [0, { c: [] }], b: 1 })).toStrictEqual(true);
      })
    ]),
    suite("Array", [
      test("empty", () => {
        expect(equal3([], [])).toStrictEqual(true);
      }),
      test("one", () => {
        expect(equal3([0], [0])).toStrictEqual(true);
      }),
      test("2d", () => {
        expect(equal3([[], [0]], [[], [0]])).toStrictEqual(true);
      }),
      test("hasObject", () => {
        expect(equal3([{ c: [] }, [0]], [{ c: [] }, [0]])).toStrictEqual(true);
      }),
      test("wrong order - false", () => {
        expect(equal3([[], [0]], [[0], []])).toStrictEqual(false);
      })
    ]),
    suite("Unhandled", [
      test("WeakMap", () => {
        expect(() => equal3(/* @__PURE__ */ new WeakMap(), /* @__PURE__ */ new WeakMap())).toThrow(TypeError);
      })
    ])
  ])
]);
//# sourceMappingURL=boolean.equal.test.js.map
