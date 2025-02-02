var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/arrayLike.chunks.test.ts
import { configure } from "@logtape/logtape";

// src/arrayLike.chunks.ts
import { getLogger } from "@logtape/logtape";
var l = getLogger(["m", "arrayLike.chunks"]);
// @__NO_SIDE_EFFECTS__
function* chunksArray(array, n) {
  if (arrayIsEmpty(array)) {
    throw new RangeError(`What's to be chunked cannot be empty`);
  }
  if (n > array.length) {
    throw new RangeError(`Initial chunk index is already out of range.`);
  }
  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n);
  }
}
__name(chunksArray, "chunksArray");
// @__NO_SIDE_EFFECTS__
function* chunksArrayLike(arrayLike, n) {
  l.debug`chunksArrayLike(arrayLike: ${arrayLike}, n: ${n})`;
  if (typeof arrayLike?.length === "number") {
    if (isEmptyArray(arrayLike)) {
      throw new RangeError(
        `What's to be chunked: ${JSON.stringify(arrayLike)} cannot be empty`
      );
    }
    if (n > arrayLike.length) {
      throw new RangeError(
        `Initial chunk index: ${n} is already out of range: ${arrayLike.length}`
      );
    }
    l.debug`arrayLike.length: ${arrayLike.length}, n: ${n}`;
  }
  const arrayLikeArray = arrayFrom(
    arrayLike
  );
  l.debug`arrayLikeArray: ${arrayLikeArray}`;
  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`
    );
  }
  if (arrayIsEmpty(arrayLikeArray)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLikeArray)} cannot be empty`
    );
  }
  if (arrayIsNonEmpty(arrayLikeArray)) {
    yield* /* @__PURE__ */ chunksArray(arrayLikeArray, n);
    return;
  }
  throw new Error(`impossible state. ${arrayLikeArray} is neither empty nor non-empty`);
}
__name(chunksArrayLike, "chunksArrayLike");
// @__NO_SIDE_EFFECTS__
async function* chunksArrayLikeAsync(arrayLike, n) {
  l.debug`chunksArrayLikeAsync(arrayLike: ${arrayLike}, n: ${n})`;
  if (typeof arrayLike?.length === "number") {
    if (isEmptyArray(arrayLike)) {
      throw new RangeError(
        `What's to be chunked: ${JSON.stringify(arrayLike)} cannot be empty`
      );
    }
    if (n > arrayLike.length) {
      throw new RangeError(
        `Initial chunk index: ${n} is already out of range: ${arrayLike.length}`
      );
    }
    l.debug`arrayLike.length: ${arrayLike.length}, n: ${n}`;
  }
  const arrayLikeArray = await arrayFromAsync(arrayLike);
  l.debug`arrayLikeArray: ${arrayLikeArray}`;
  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`
    );
  }
  if (arrayIsEmpty(arrayLikeArray)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLikeArray)} cannot be empty`
    );
  }
  if (arrayIsNonEmpty(arrayLikeArray)) {
    yield* /* @__PURE__ */ chunksArray(arrayLikeArray, n);
    return;
  }
  throw new Error(`impossible state. ${arrayLikeArray} is neither empty nor non-empty`);
}
__name(chunksArrayLikeAsync, "chunksArrayLikeAsync");

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
function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
__name(isObject, "isObject");
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
// @__NO_SIDE_EFFECTS__
function isEmptyArray(value) {
  return isArray(value) && value.length === 0;
}
__name(isEmptyArray, "isEmptyArray");
// @__NO_SIDE_EFFECTS__
function arrayIsEmpty(value) {
  return value.length === 0;
}
__name(arrayIsEmpty, "arrayIsEmpty");
// @__NO_SIDE_EFFECTS__
function arrayIsNonEmpty(value) {
  return isArray(value) && value.length !== 0;
}
__name(arrayIsNonEmpty, "arrayIsNonEmpty");

// src/arrayLike.from.ts
// @__NO_SIDE_EFFECTS__
async function arrayFromAsync(arrayLike, mapFn) {
  const arrayLikeArray = isArray(arrayLike) ? arrayLike : await (async (arrayLike2) => {
    const newArrayLikeArray = [];
    for await (const element of arrayLike2) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike);
  if (!mapFn) {
    return arrayLikeArray;
  }
  const promisableArray = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    promisableArray.push(mapFn(element, index));
    index++;
  }
  return await Promise.all(promisableArray);
}
__name(arrayFromAsync, "arrayFromAsync");
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

// src/boolean.equal.ts
import { getLogger as getLogger3 } from "@logtape/logtape";

// src/error.assert.equal.ts
// @__NO_SIDE_EFFECTS__
async function assertAsync(expected, actual) {
  await equalsAsyncOrThrow(expected)(actual);
}
__name(assertAsync, "assertAsync");
// @__NO_SIDE_EFFECTS__
function assert(expected, actual) {
  equalsOrThrow(expected)(actual);
}
__name(assert, "assert");

// src/error.assert.throw.ts
import { getLogger as getLogger2 } from "@logtape/logtape";
var l2 = getLogger2(["m", "error.assert.throw"]);
// @__NO_SIDE_EFFECTS__
async function assertThrowAsync(error, fn) {
  try {
    await fn();
  } catch (actualError) {
    l2.debug`assertThrowAsync(error: ${error}, fn: ${String(fn)}), actualError: ${// TODO: Raise issue on logtape for better stringify of fn and error
    String(actualError)}`;
    if (typeof error === "function") {
      if (!(actualError instanceof error)) {
        throw new Error(`actualError ${actualError} does not match error: ${error}`);
      }
      return;
    }
    const equalErrorOrThrow = equalsOrThrow(error);
    if (error instanceof Error) {
      equalErrorOrThrow(actualError);
      return;
    }
    if (typeof error !== "string") {
      throw new Error(`unexpected type ${typeof error} of expected error: ${error}`);
    }
    if (error === "Error") {
      if (!(actualError instanceof Error)) {
        throw new Error(`actualError ${actualError} is not an Error`);
      }
      return;
    }
    if (error.endsWith("Error")) {
      equalErrorOrThrow(actualError?.name);
      return;
    }
    equalErrorOrThrow(actualError.message);
    return;
  }
  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}
__name(assertThrowAsync, "assertThrowAsync");
// @__NO_SIDE_EFFECTS__
function assertThrow(error, fn) {
  try {
    fn();
  } catch (actualError) {
    l2.debug`assertThrow(error: ${error}, fn: ${String(fn)}), actualError: ${String(actualError)}`;
    if (typeof error === "function") {
      if (!(actualError instanceof error)) {
        throw new Error(`actualError ${actualError} does not match error: ${error}`);
      }
      return;
    }
    const equalErrorOrThrow = equalsOrThrow(error);
    if (error instanceof Error) {
      equalErrorOrThrow(actualError);
      return;
    }
    if (typeof error !== "string") {
      throw new Error(`unexpected type ${typeof error} of expected error: ${error}`);
    }
    if (error === "Error") {
      if (!(actualError instanceof Error)) {
        throw new Error(`actualError ${actualError} is not an Error`);
      }
      return;
    }
    if (error.endsWith("Error")) {
      equalErrorOrThrow(actualError?.name);
      return;
    }
    equalErrorOrThrow(actualError.message);
    return;
  }
  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}
__name(assertThrow, "assertThrow");
// @__NO_SIDE_EFFECTS__
async function assertThrowRangeErrorAsync(fn) {
  await /* @__PURE__ */ assertThrowAsync("RangeError", fn);
}
__name(assertThrowRangeErrorAsync, "assertThrowRangeErrorAsync");
// @__NO_SIDE_EFFECTS__
function assertThrowRangeError(fn) {
  /* @__PURE__ */ assertThrow("RangeError", fn);
}
__name(assertThrowRangeError, "assertThrowRangeError");

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

// src/promise.is.ts
// @__NO_SIDE_EFFECTS__
function isPromise(value) {
  return typeof value?.then === "function";
}
__name(isPromise, "isPromise");

// src/string.is.ts
// @__NO_SIDE_EFFECTS__
function isString(value) {
  return typeof value === "string";
}
__name(isString, "isString");
// @__NO_SIDE_EFFECTS__
function isRegexp(value) {
  return Object.prototype.toString.call(value) === "[object RegExp]";
}
__name(isRegexp, "isRegexp");

// src/boolean.equal.ts
var l3 = getLogger3(["m", "boolean.equal"]);
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
  if (isString(value)) {
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
  l3.debug`value ${value} is not a primitive`;
  return false;
}
__name(isPrimitive, "isPrimitive");
// @__NO_SIDE_EFFECTS__
function equal(a, b) {
  l3.debug`a: ${String(a)}, b: ${String(b)}`;
  if (Object.is(a, b)) {
    return true;
  }
  l3.debug`ref/primitive eq failed on a: ${String(a)}, b: ${String(b)}`;
  if (/* @__PURE__ */ isPrimitive(a) || /* @__PURE__ */ isPrimitive(b)) {
    l3.debug`At least one of a: ${String(a)} and b: ${String(b)} is primitive`;
    return false;
  }
  l3.debug`non-primitives a: ${a}, b: ${b}`;
  if (isPromise(a) || isPromise(b)) {
    throw new TypeError(`At least one of a: ${a} and b: ${b} is a thenable.
      We cannot handle comparing them in a sync function.
      Try equalAsync()`);
  }
  if (typeof a === "function") {
    if (typeof b !== "function") {
      l3.info`Is it intentional trying to compare a function a: ${a} to not function b: ${b}?`;
      return false;
    }
    l3.warn`cannot compare two functions accurately due to the inherent unpredictability of functions.
    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal
    The string representations of both functions are not normalized before comparison.
    Nor were the functions converted to there AST form.
    Therefore, this comparison has a high chance of giving a false negative or false positive.
    `;
    return `${a}` === `${b}`;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      l3.info`Is it intentional trying to compare an array a: ${a} to not array b: ${b}?`;
      return false;
    }
    l3.debug`arrays a: ${a} b: ${b}`;
    if (a.length !== b.length) {
      return false;
    }
    if (a.length === 0) {
      return true;
    }
    return a.every(
      (aValue, aIndex) => (
        // Have to do a recursion here because the two arrays might not just contain primitives.
        /* @__PURE__ */ equal(aValue, b[aIndex])
      )
    );
  }
  if (typeof a === "object") {
    if (typeof b !== "object") {
      l3.warn`b is not a primitive, not a Promise, not a function, not an array, not an object.
        What is b: ${b}?`;
      return false;
    }
    l3.debug`objects a: ${a} b: ${b}`;
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
        l3.info`Is it intentional trying to compare a Date a: ${a} to not a Date b: ${b}?`;
        return false;
      }
      l3.debug`dates a: ${a} b: ${b}`;
      if (a.getTime() === b.getTime()) {
        return true;
      }
      return false;
    }
    if (aPrototype === "[object Boolean]") {
      l3.warn`The use of Boolean() the object wrapper is greatly discouraged. Found a: ${a}`;
      if (bPrototype !== "[object Boolean]") {
        l3.info`Is it intentional trying to compare a Boolean wrapped a: ${a} to not a Boolean wrapped b: ${b}?`;
        return false;
      }
      l3.debug`Boolean wraps a: ${a} b: ${b}`;
      if (a.valueOf() === b.valueOf()) {
        return true;
      }
      return false;
    }
    if (isError(a)) {
      if (!isError(b)) {
        l3.info`Is it intentional trying to compare a error a: ${a} to not error b: ${b}?`;
        return false;
      }
      l3.debug`Errors a: ${a} b: ${b}`;
      if (a.message !== b.message) {
        return false;
      }
      if (a.name !== b.name) {
        l3.info`Is it intentional,
          giving two errors of different classes a: ${a.name} b: ${b.name}
          the same message: ${a.message}?`;
        return false;
      }
      if (/* @__PURE__ */ equal(a?.cause, b?.cause)) {
        return true;
      }
      return false;
    }
    if (isGenerator(a)) {
      if (!isGenerator(b)) {
        l3.info`Is it intentional trying to compare a Generator a: ${a} to not a Generator b: ${b}?`;
        return false;
      }
      l3.info`comparing two Generators would only succeed
        if both of them never takes any parameters.`;
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isRegexp(a)) {
      if (!isRegexp(b)) {
        l3.info`Is it intentional trying to compare a regex a: ${a} to not a regex b: ${b}?`;
        return false;
      }
      l3.debug`regexps a: ${a} b: ${b}`;
      return `${a}` === `${b}`;
    }
    if (isMap(a)) {
      if (!isMap(b)) {
        l3.info`Is it intentional trying to compare a map a: ${a} to not a map b: ${b}?`;
        return false;
      }
      l3.debug`maps a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isSet(a)) {
      if (!isSet(b)) {
        l3.info`Is it intentional trying to compare a set a: ${a} to not a set b: ${b}?`;
        return false;
      }
      l3.debug`sets a: ${a} b: ${b}`;
      if (a.size !== b.size) {
        return false;
      }
      if (a.size === 0) {
        return true;
      }
      return /* @__PURE__ */ equal(arrayFrom(a), arrayFrom(b));
    }
    if (isWeakMap(a) || isWeakMap(b)) {
      throw new TypeError(`WeakMaps are not enumerable, therefore cannot be compared.`);
    }
    if (isWeakSet(a) || isWeakSet(b)) {
      throw new TypeError(`WeakSets are not enumerable, therefore cannot be compared.`);
    }
    if (isObject(a)) {
      l3.info`Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor`;
      if (!isObject(b)) {
        l3.info`Is it intentional trying to compare an object Object a: ${a} to not an object Object b: ${b}?`;
        return false;
      }
      l3.debug`Objects a: ${a} b: ${b}`;
      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }
      return Object.keys(a).every((aKey) => /* @__PURE__ */ equal(a[aKey], b[aKey]));
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
__name(equal, "equal");
// @__NO_SIDE_EFFECTS__
async function equalAsync(a, b) {
  if (isPromise(a) || isPromise(b)) {
    l3.debug`Promises a: ${a} b: ${b}`;
    const [settledA, settledB] = await Promise.allSettled([a, b]);
    l3.debug`settled a: ${settledA} b: ${settledB}`;
    return /* @__PURE__ */ equal(settledA, settledB);
  }
  if (isAsyncGenerator(a) && isAsyncGenerator(b)) {
    l3.info`Comparing two Generators or AsyncGenerators can only succeed
    if both of them never takes any parameters.`;
    return /* @__PURE__ */ equal(await arrayFromAsync(a), await arrayFromAsync(b));
  }
  if (isAsyncIterable(a) && isAsyncIterable(b)) {
    return /* @__PURE__ */ equal(await arrayFromAsync(a), await arrayFromAsync(b));
  }
  return /* @__PURE__ */ equal(a, b);
}
__name(equalAsync, "equalAsync");

// src/function.equals.ts
// @__NO_SIDE_EFFECTS__
function equalsOrThrow(equalTo) {
  return function(input) {
    if (equal(input, equalTo)) {
      return input;
    }
    throw new Error(`input ${input} isn't equal to ${equalTo}`);
  };
}
__name(equalsOrThrow, "equalsOrThrow");
// @__NO_SIDE_EFFECTS__
function equalsAsyncOrThrow(equalTo) {
  return async function(input) {
    if (await equalAsync(input, equalTo)) {
      return input;
    }
    throw new Error(`input ${input} isn't equal to ${equalTo}`);
  };
}
__name(equalsAsyncOrThrow, "equalsAsyncOrThrow");

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
import { getLogger as getLogger4 } from "@logtape/logtape";
var testFileBasename = new URL(import.meta.url).pathname.split("/").at(-1);
var testedFileName = testFileBasename.endsWith(".test.js") ? testFileBasename.slice(0, -".test.js".length) : testFileBasename;
var l4 = getLogger4(["t", testedFileName]);
// @__NO_SIDE_EFFECTS__
async function suite(name, testOrSuites, options) {
  l4.debug`suite ${name} started: ${testOrSuites.length} tests or suites`;
  const result = await Promise.allSettled(testOrSuites);
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "todo")) {
      l4.info`suite ${name} finished: ${JSON.stringify(result)}`;
      return { name, todo: options.todo, result };
    }
  }
  const errored = result.find((settledResult) => settledResult.status === "rejected");
  if (errored) {
    throw new Error(`suite ${name} errored with result: ${JSON.stringify(result)}`, {
      cause: errored.reason
    });
  }
  l4.debug`suite ${name} finished: ${JSON.stringify(result)}`;
  return { name, result };
}
__name(suite, "suite");
// @__NO_SIDE_EFFECTS__
async function test(name, callback, options) {
  let timeLimit = 0;
  let took = 0;
  if (options) {
    if (Object.hasOwn(options, "skip")) {
      l4.warn`${name} skipped: ${options.skip}`;
      return { name, skip: options.skip };
    }
    if (Object.hasOwn(options, "timeLimit")) {
      timeLimit = typeof options.timeLimit === "number" ? options.timeLimit : await (async () => {
        const beforeExecutingTimeLimitReferenceCallback = performance.now();
        try {
          await options.timeLimit();
        } catch (timeLimitFnError) {
          l4.info`timeLimit fn threw ${timeLimitFnError}
            If this is intentional, you can ignore this log.
            The test will continue,
            the time it takes would be compared to the time timeLimit fn executed until it errored.`;
        }
        const afterExecutingTimeLimitReferenceCallback = performance.now();
        return afterExecutingTimeLimitReferenceCallback - beforeExecutingTimeLimitReferenceCallback;
      })();
      l4.debug`${name} timeLimit: ${timeLimit}ms`;
    }
    if (Object.hasOwn(options, "todo")) {
      l4.info`${name} started: ${callback} with todo: ${options.todo}`;
      try {
        const beforeExecutingTestingCallback = performance.now();
        const result = await callback();
        const afterExecutingTestingCallback = performance.now();
        took = afterExecutingTestingCallback - beforeExecutingTestingCallback;
        l4.debug`${name} took: ${took}ms`;
        if (result !== void 0 && result !== null) {
          if (took > timeLimit) {
            const tooLongPercentage = 100 * (took - timeLimit) / timeLimit;
            l4.error`${name} with todo: ${options.todo} took: ${took}ms, ${took - timeLimit}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`;
            return {
              name,
              todo: options.todo,
              result,
              tooLongPercentage
            };
          }
          l4.warn`${name} with todo: ${options.todo} finished: ${result}`;
          return { name, todo: options.todo, result };
        }
        if (took > timeLimit) {
          const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
          l4.error`${name} with todo: ${options.todo} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long.`;
          return { name, todo: options.todo, tooLongPercentage };
        }
        l4.warn`${name} with todo: ${options.todo} finished`;
        return { name, todo: options.todo };
      } catch (e) {
        l4.error`${name} with todo: ${options.todo} errored: ${e}`;
        return { name, todo: options.todo, result: e };
      }
    }
  }
  l4.debug`${name} started: ${String(callback).slice(0, 64)}`;
  try {
    const result = await callback();
    if (took > timeLimit) {
      const tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
      throw new RangeError(
        `${name} took: ${Math.round(took)}ms, ${Math.round(took - timeLimit)}ms longer than timeLimit: ${timeLimit}ms, that's ${tooLongPercentage}% too long. finished: ${result}`
      );
    }
    if (result !== void 0 && result !== null) {
      l4.info`${name} finished: ${result}`;
      return { name, result };
    }
    l4.debug`${name} finished`;
    return name;
  } catch (callbackError) {
    throw new Error(`${name}: ${String(callback)} errored`, { cause: callbackError });
  }
}
__name(test, "test");

// src/arrayLike.chunks.test.ts
await configure(logtapeConfiguration());
suite("chunksArray", [
  test("empty", () => {
    assertThrowRangeError(
      () => {
        arrayFrom(chunksArray(
          // Test: should error on the type level.
          // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [any, ...any[]]'.  Source has 0 element(s) but target requires 1.ts(2345)
          [],
          1
        ));
      }
    );
  }),
  test("1", () => {
    assert(function* () {
      yield [1];
    }(), chunksArray([1], 1));
  }),
  test("2 1", () => {
    assert(function* () {
      yield [1];
      yield [2];
    }(), chunksArray([1, 2], 1));
  }),
  test("2 2", () => {
    assert(function* () {
      yield [1, 2];
    }(), chunksArray([1, 2], 2));
  }),
  test("out", () => {
    assertThrowRangeError(() => {
      arrayFrom(chunksArray(
        [1],
        // Test: should error on the type level.
        // @ts-expect-error Argument of type '2' is not assignable to parameter of type '1'.ts(2345)
        2
      ));
    });
  })
]);
suite("chunksArrayLike", [
  suite("array", [
    test("empty", () => {
      assertThrowRangeError(
        () => {
          arrayFrom(chunksArrayLike(
            // Due to TypeScript limitations,
            // this should error on the type level but the erroring behavior cannot be implemented.
            [],
            1
          ));
        }
      );
    }),
    test("1", () => {
      assert(function* () {
        yield [1];
      }(), chunksArrayLike([1], 1));
    }),
    test("2 1", () => {
      assert(function* () {
        yield [1];
        yield [2];
      }(), chunksArrayLike([1, 2], 1));
    }),
    test("2 2", () => {
      assert(function* () {
        yield [1, 2];
      }(), chunksArrayLike([1, 2], 2));
    }),
    test("out", () => {
      assertThrowRangeError(() => {
        arrayFrom(chunksArrayLike(
          [1],
          // Due to TypeScript limitations,
          // this should error on the type level but the erroring behavior cannot be implemented.
          2
        ));
      });
    })
  ]),
  suite("iterable", [
    test("empty", () => {
      assertThrowRangeError(
        () => {
          arrayFrom(chunksArrayLike(
            function* () {
            }(),
            1
          ));
        }
      );
    }),
    test("1", () => {
      assert(
        function* () {
          yield [1];
        }(),
        chunksArrayLike(function* () {
          yield 1;
        }(), 1)
      );
    }),
    test("2 1", () => {
      assert(
        function* () {
          yield [1];
          yield [2];
        }(),
        chunksArrayLike(function* () {
          yield 1;
          yield 2;
        }(), 1)
      );
    }),
    test("2 2", () => {
      assert(
        function* () {
          yield [1, 2];
        }(),
        chunksArrayLike(function* () {
          yield 1;
          yield 2;
        }(), 2)
      );
    }),
    test("out", () => {
      assertThrowRangeError(() => {
        arrayFrom(chunksArrayLike(
          function* () {
            yield 1;
          }(),
          2
        ));
      });
    })
  ])
]);
suite("chunksArrayLikeAsync", [
  suite("array", [
    test("empty", async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            // Due to TypeScript limitations,
            // this should error on the type level but the erroring behavior cannot be implemented.
            [],
            1
          ));
        }
      );
    }),
    test("1", async () => {
      await assertAsync(async function* () {
        yield [1];
      }(), chunksArrayLikeAsync([1], 1));
    }),
    test("2 1", async () => {
      await assertAsync(async function* () {
        yield [1];
        yield [2];
      }(), chunksArrayLikeAsync([1, 2], 1));
    }),
    test("2 2", async () => {
      await assertAsync(async function* () {
        yield [1, 2];
      }(), chunksArrayLikeAsync([1, 2], 2));
    }),
    test("out", async () => {
      await assertThrowRangeErrorAsync(async () => {
        await arrayFromAsync(chunksArrayLikeAsync(
          [1],
          // Due to TypeScript limitations,
          // this should error on the type level but the erroring behavior cannot be implemented.
          2
        ));
      });
    })
  ]),
  suite("iterable", [
    test("empty", async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            function* () {
            }(),
            1
          ));
        }
      );
    }),
    test("1", async () => {
      await assertAsync(async function* () {
        yield [1];
      }(), chunksArrayLikeAsync(async function* () {
        yield 1;
      }(), 1));
    }),
    test("2 1", async () => {
      await assertAsync(async function* () {
        yield [1];
        yield [2];
      }(), chunksArrayLikeAsync(async function* () {
        yield 1;
        yield 2;
      }(), 1));
    }),
    test("2 2", async () => {
      await assertAsync(async function* () {
        yield [1, 2];
      }(), chunksArrayLikeAsync(async function* () {
        yield 1;
        yield 2;
      }(), 2));
    }),
    test("out", async () => {
      await assertThrowRangeErrorAsync(async () => {
        await arrayFromAsync(chunksArrayLikeAsync(
          async function* () {
            yield 1;
          }(),
          2
        ));
      });
    })
  ]),
  suite("AsyncIterable", [
    test("empty", async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            async function* () {
            }(),
            1
          ));
        }
      );
    }),
    test("1", async () => {
      await assertAsync(
        async function* () {
          yield [1];
        }(),
        chunksArrayLikeAsync(async function* () {
          yield 1;
        }(), 1)
      );
    }),
    test("2 1", async () => {
      await assertAsync(
        async function* () {
          yield [1];
          yield [2];
        }(),
        chunksArrayLikeAsync(async function* () {
          yield 1;
          yield 2;
        }(), 1)
      );
    }),
    test("2 2", async () => {
      await assertAsync(
        async function* () {
          yield [1, 2];
        }(),
        chunksArrayLikeAsync(async function* () {
          yield 1;
          yield 2;
        }(), 2)
      );
    }),
    test("out", async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            async function* () {
              yield 1;
            }(),
            2
          ));
        }
      );
    })
  ])
]);
//# sourceMappingURL=arrayLike.chunks.test.js.map
